// /js/barter-chat.js
// Buyer ↔ Seller chat for a product (barter-friendly), with file attachments

import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

/** ---------- DOM refs (必须在页面里有这些 id) ---------- */
const modal      = document.getElementById("barterChatModal");
const titleEl    = document.getElementById("barterChatTitle");
const infoEl     = document.getElementById("barterChatProductInfo");
const listEl     = document.getElementById("barterChatMessages");
const offerInput = document.getElementById("barterOfferInput");
const textInput  = document.getElementById("barterTextInput");
const fileInput  = document.getElementById("barterFileInput"); // ✅ 附件输入
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
  requestAnimationFrame(() => {
    listEl.scrollTop = listEl.scrollHeight;
  });
}
function clearList() { listEl.innerHTML = ""; }

/** 渲染消息气泡（含附件预览/链接） */
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
  if (typeof msg.extra_cents === "number" && msg.extra_cents > 0) {
    lines.push(`💰 Extra: ${fmtMoneyFromCents(msg.extra_cents)}`);
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
  return `${productId}_${buyerUid}_${sellerUid}`;
}

/** 确保线程存在；若没有则创建 */
async function ensureThread(product) {
  const productId = product.id;
  const sellerUid = product.seller_uid;
  const buyerUid  = currentUser.uid;

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
async function sendMessage(text, extraCents) {
  if (!currentThread || !currentUser) return;

  // 附件（可选）
  let attachment = null;
  const file = fileInput?.files?.[0] || null;
  if (file) {
    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) throw new Error("File too large (>25MB)");
    const storage = getStorage();
    const path = `barter_attachments/${currentThread.id}/${currentUser.uid}_${Date.now()}_${file.name}`;
    const ref  = sRef(storage, path);
    await uploadBytes(ref, file);
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
    extra_cents: typeof extraCents === "number" ? extraCents : 0,
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
      || (payload.extra_cents > 0 ? `Extra ${fmtMoneyFromCents(payload.extra_cents)}`
      : (attachment ? `[Attachment] ${attachment.name}` : "")),
    last_sender_uid: payload.sender_uid,
    last_extra_cents: payload.extra_cents || 0,
    last_message_at: serverTimestamp()
  });

  // 清空文件输入
  if (fileInput) fileInput.value = "";
}

/** ---------- UI open/close ---------- */
function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex"); // 需要 .flex { display:flex }
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
/** 在商品页/列表中打开聊天（传 product 对象或 productId） */
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

/** 通过 threadId 打开（给 /my-chats 用） */
async function openByThreadId(threadId) {
  try {
    if (!ensureLoggedIn()) return;

    const tRef = doc(db, "barter_threads", threadId);
    const tSnap = await getDoc(tRef);
    if (!tSnap.exists()) { alert("Thread not found."); return; }
    const t = { id: tSnap.id, ...tSnap.data() };

    // 权限：仅参与者可看（rules 里也会拦）
    if (![t.buyer_uid, t.seller_uid].includes(currentUser.uid)) {
      alert("You are not a participant of this thread.");
      return;
    }

    currentThread = t;

    // 尝试显示更完整的产品文案
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

  const text = (textInput.value || "").trim();
  const extraRaw = (offerInput.value || "").trim();
  const extraCents = extraRaw ? parseInt(extraRaw, 10) : 0;

  if (!text && (!extraCents || Number.isNaN(extraCents)) && !(fileInput?.files?.length)) {
    alert("Type a message, or fill extra cents, or attach a file.");
    return;
  }

  try {
    sendBtn.disabled = true;
    await sendMessage(text, Number.isNaN(extraCents) ? 0 : extraCents);
    textInput.value = "";
    await sleep(50);
    scrollToBottom();
  } catch (e) {
    console.error("send error:", e);
    alert(e?.message || "Failed to send message.");
  } finally {
    sendBtn.disabled = false;
  }
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
