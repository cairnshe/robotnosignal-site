// /js/barter-chat.js
// Buyer ↔ Seller chat for a product (barter-friendly), with file attachments

import { db, auth, storage } from "/js/firebase-config.js"; // ← 多了 storage
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";


/** ---------- DOM refs ---------- */
const modal      = document.getElementById("barterChatModal");
const titleEl    = document.getElementById("barterChatTitle");
const infoEl     = document.getElementById("barterChatProductInfo");
const listEl     = document.getElementById("barterChatMessages");
const offerInput = document.getElementById("barterOfferInput"); // text + inputmode=decimal
const textInput  = document.getElementById("barterTextInput");
const fileInput  = document.getElementById("barterFileInput");
const hintEl     = document.getElementById("barterChatHint");
const sendBtn    = document.getElementById("barterSendBtn");
const closeBtn   = document.getElementById("barterChatClose");

/** ---------- runtime state ---------- */
let currentUser     = null;
let currentThread   = null; // { id, product_id, buyer_uid, seller_uid, ... }
let messagesUnsub   = null; // snapshot unsubscribe
let currentProduct  = null; // { id, name, image_url, seller_uid, ... }

/** ---------- utils ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureLoggedIn() {
  if (!currentUser) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return false;
  }
  return true;
}
function fmtMoneyFromCents(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "";
  return `$${(cents / 100).toFixed(2)}`;
}
function scrollToBottom() {
  requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight; });
}
function clearList() { listEl.innerHTML = ""; }

/** 把“5”、“5.25”、“$5,25”、“CAD 5.2”等解析为整数 cents */
function parseOfferToCents(input) {
  if (!input) return 0;
  let s = String(input).trim();

  // 去货币符号与空格
  s = s.replace(/[^\d.,-]/g, "");

  // 如果同时含有逗号与点：约定逗号为千分位，点为小数点（北美格式）
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    // 只有逗号时，按欧陆风格把逗号当小数点
    s = s.replace(",", ".");
  }

  // 只保留 [-]?[0-9]+(.[0-9]{0,})?
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;

  const val = parseFloat(m[0]);
  if (Number.isNaN(val)) return 0;

  // 仅允许非负
  const dollars = Math.max(0, val);
  // 转 cents（四舍五入到两位）
  return Math.round(dollars * 100);
}

/** 渲染消息（兼容 offer_extra_cents/extra_cents） */
function renderMessageRow(msg, isSelf) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.justifyContent = isSelf ? "flex-end" : "flex-start";
  wrap.style.padding = "2px 0";

  const bubble = document.createElement("div");
  bubble.style.maxWidth = "80%";
  bubble.style.borderRadius = "12px";
  bubble.style.padding = "8px 10px";
  bubble.style.fontSize = "14px";
  bubble.style.lineHeight = "1.4";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.wordBreak = "break-word";
  bubble.style.background = isSelf ? "#111" : "#fff";
  bubble.style.color = isSelf ? "#fff" : "#111";
  bubble.style.border = isSelf ? "none" : "1px solid #eee";
  bubble.style.boxShadow = isSelf ? "none" : "0 2px 8px rgba(0,0,0,.04)";

  const lines = [];
  const cents = typeof msg.offer_extra_cents === "number"
    ? msg.offer_extra_cents
    : (typeof msg.extra_cents === "number" ? msg.extra_cents : 0);

  if (cents > 0) {
    lines.push(`💰 Extra: ${fmtMoneyFromCents(cents)}`);
  }
  if (msg.text && msg.text.trim()) lines.push(msg.text.trim());
  bubble.textContent = lines.join("\n");

  if (msg.attachment?.url) {
    const attWrap = document.createElement("div");
    attWrap.style.marginTop = "6px";

    const mime = msg.attachment.mime_type || "";
    if (mime.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = msg.attachment.url;
      img.alt = msg.attachment.name || "image";
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      img.style.display = "block";
      attWrap.appendChild(img);
    }
    const a = document.createElement("a");
    a.href = msg.attachment.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = msg.attachment.name || "Attachment";
    a.style.display = "inline-block";
    a.style.marginTop = "4px";
    a.style.textDecoration = "underline";
    a.style.color = isSelf ? "#fff" : "#2563eb";
    attWrap.appendChild(a);

    bubble.appendChild(attWrap);
  }

  const meta = document.createElement("div");
  meta.style.fontSize = "11px";
  meta.style.color = "#888";
  meta.style.marginTop = "4px";
  const when = msg.created_at?.toDate ? msg.created_at.toDate() : new Date();
  meta.textContent = `${msg.sender_email || msg.sender_uid || ""} • ${when.toLocaleString()}`;

  const cell = document.createElement("div");
  cell.appendChild(bubble);
  cell.appendChild(meta);

  wrap.appendChild(cell);
  return wrap;
}

/** ---------- Firestore helpers ---------- */
function computeThreadId(productId, buyerUid, sellerUid) {
  const pair = [buyerUid, sellerUid].sort().join('_');
  return `${productId}_${pair}`;
}

/** 确保线程存在；若没有则创建 */
async function ensureThread(product) {
  const productId = product.id;
  const sellerUid = product.seller_uid;
  const buyerUid  = currentUser.uid;

 // 🚨 新增的检查（就在这里）
  if (currentUser.uid === sellerUid) {
    // 卖家不应该自己发起新线程
    throw new Error("As the seller, please use 'View Barter Requests' to chat with buyers.");
  }
  
  const threadId  = computeThreadId(productId, buyerUid, sellerUid);
  const threadRef = doc(db, "barter_threads", threadId);
  const snap      = await getDoc(threadRef);

  if (!snap.exists()) {
    const base = {
      product_id: productId,
      product_name: product.name || "",
      product_image: product.image_url || "",
      buyer_uid: buyerUid,
      seller_uid: sellerUid,
      buyer_email: currentUser.email || "",
      seller_email: product.seller_email || "",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      last_message: "",
      last_sender_uid: "",
      last_extra_cents: 0,
      last_message_at: serverTimestamp(),
      participants: [buyerUid, sellerUid],
    };
    await setDoc(threadRef, base);
    return { id: threadId, ...base };
  }
  return { id: threadId, ...snap.data() };
}

/** 订阅消息 */
function subscribeMessages(thread) {
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

  const q = query(
    collection(db, "barter_threads", thread.id, "messages"),
    orderBy("created_at", "asc")
  );

  messagesUnsub = onSnapshot(
    q,
    (qs) => {
      clearList();
      qs.forEach((d) => {
        const m = d.data();
        const isSelf = m.sender_uid === currentUser?.uid;
        listEl.appendChild(renderMessageRow(m, isSelf));
      });
      scrollToBottom();
    },
    (err) => {
      console.error("Messages subscribe error:", err);
      hintEl.textContent = "⚠️ Failed to load messages.";
    }
  );
}

/** 发送消息（含可选附件上传） */
async function sendMessage(text, offerCents) {
  if (!currentThread || !currentUser) return;

  hintEl.textContent = "Sending…";
  sendBtn.disabled = true;
  sendBtn.dataset.loading = "1";

  try {
    // 附件（可选）
    let attachment = null;
    const file = fileInput?.files?.[0] || null;
    if (file) {
      hintEl.textContent = "Uploading attachment…";
      const MAX = 25 * 1024 * 1024;
      if (file.size > MAX) throw new Error("File too large (>25MB).");
      
const safeName = file.name.replace(/[^\w.\-]+/g, "_");
const path = `barter_attachments/${currentThread.id}/${currentUser.uid}_${Date.now()}_${safeName}`;

 const ref  = sRef(storage, path); // ✅ 使用 firebase-config.js 里导出的 storage

      await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
      const url = await getDownloadURL(ref);
      attachment = {
        url,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size
      };
    }

    const payload = {
      text: (text || "").trim(),
      offer_extra_cents: typeof offerCents === "number" ? offerCents : 0, // ← 与规则对齐
      sender_uid: currentUser.uid,
      sender_email: currentUser.email || "",
      created_at: serverTimestamp(),
      attachment: attachment || null
    };

    const msgsCol = collection(db, "barter_threads", currentThread.id, "messages");
    await addDoc(msgsCol, payload);

    await updateDoc(doc(db, "barter_threads", currentThread.id), {
      updated_at: serverTimestamp(),
      last_message: payload.text
        || (payload.offer_extra_cents > 0 ? `Extra ${fmtMoneyFromCents(payload.offer_extra_cents)}`
        : (attachment ? `[Attachment] ${attachment.name}` : "")),
      last_sender_uid: payload.sender_uid,
      last_extra_cents: payload.offer_extra_cents || 0,
      last_message_at: serverTimestamp()
    });

    // 清空输入
    if (fileInput) fileInput.value = "";
    hintEl.textContent = "Sent.";
    setTimeout(() => { hintEl.textContent = ""; }, 1200);
  } catch (err) {
    console.error("send error:", err);
    // Storage 常见错误提示
    if (String(err?.message || "").includes("retry-limit")) {
      alert("Firebase Storage: Retry limit exceeded. Please try again in a moment.");
    } else {
      alert(err?.message || "Failed to send message.");
    }
    hintEl.textContent = "Failed to send.";
  } finally {
    sendBtn.disabled = false;
    delete sendBtn.dataset.loading;
  }
}

/** ---------- UI open/close ---------- */
function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  requestAnimationFrame(scrollToBottom);
}
function closeModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
  currentThread  = null;
  currentProduct = null;
  textInput.value  = "";
  offerInput.value = "";
  hintEl.textContent = "";
  if (fileInput) fileInput.value = "";
}

/** ---------- public API ---------- */
async function openForProduct(productOrId) {
  try {
    if (!ensureLoggedIn()) return;

    // 1) 读 product
    let product = null;
    if (typeof productOrId === "string") {
      const pRef = doc(db, "products", productOrId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) { alert("Product not found."); return; }
      product = { id: pSnap.id, ...pSnap.data() };
    } else if (productOrId && typeof productOrId === "object") {
      product = productOrId;
    } else { alert("Invalid product."); return; }

    currentProduct = product;
    const sellerUid = product.seller_uid;
    if (!sellerUid) { alert("Seller not found on this product."); return; }

    // 2) 确保 thread
    currentThread = await ensureThread(product);

    // 3) UI
    titleEl.textContent = "Barter Chat";
    infoEl.textContent = `Product: ${product.name || "(no name)"} • Seller: ${product.seller_name || product.seller_email || product.seller_uid || ""}`;
    hintEl.textContent = currentUser.uid === sellerUid ? "You are chatting as the seller." : "You are chatting as the buyer.";

    // 4) 订阅并打开
    subscribeMessages(currentThread);
    openModal();
  } catch (err) {
    console.error("openForProduct error:", err);
    alert(err?.message || "Failed to open chat.");
  }
}

async function openByThreadId(threadId) {
  try {
    if (!ensureLoggedIn()) return;

    const tRef = doc(db, "barter_threads", threadId);
    const tSnap = await getDoc(tRef);
    if (!tSnap.exists()) { alert("Thread not found."); return; }
    const t = { id: tSnap.id, ...tSnap.data() };

    if (![t.buyer_uid, t.seller_uid].includes(currentUser.uid)) {
      alert("You are not a participant of this thread.");
      return;
    }

    currentThread = t;

    let name = t.product_name || "";
    if (!name && t.product_id) {
      const pSnap = await getDoc(doc(db, "products", t.product_id));
      if (pSnap.exists()) name = pSnap.data().name || "";
    }

    const who = currentUser.uid === t.seller_uid ? (t.buyer_email || t.buyer_uid) : (t.seller_email || t.seller_uid);
    titleEl.textContent = "Barter Chat";
    infoEl.textContent = `Product: ${name || "(no name)"} • With: ${who || ""}`;
    hintEl.textContent = currentUser.uid === t.seller_uid ? "You are chatting as the seller." : "You are chatting as the buyer.";

    subscribeMessages(currentThread);
    openModal();
  } catch (e) {
    console.error("openByThreadId error:", e);
    alert(e?.message || "Failed to open chat.");
  }
}

/** ---------- events ---------- */
sendBtn?.addEventListener("click", async () => {
  if (!currentThread) return;
  if (sendBtn.dataset.loading === "1") return; // 防抖

  const text = (textInput.value || "").trim();
  const extraRaw = (offerInput.value || "").trim();
  const offerCents = parseOfferToCents(extraRaw); // 统一转 cents
  const hasFile = Boolean(fileInput?.files?.length);

  if (!text && offerCents <= 0 && !hasFile) {
    alert("Type a message, or enter an extra amount, or attach a file.");
    return;
  }

  await sendMessage(text, offerCents);
  textInput.value = "";
  // 是否清空金额由你决定；这里保留输入，便于连续报价
  // offerInput.value = "";
  await sleep(50);
  scrollToBottom();
});

textInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    sendBtn.click();
  }
});

closeBtn?.addEventListener("click", closeModal);

/** ---------- auth bootstrap ---------- */
onAuthStateChanged(auth, (u) => { currentUser = u || null; });

/** ---------- export ---------- */
window.BarterChat = {
  openForProduct,
  openByThreadId,
};
