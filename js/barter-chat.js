// /js/barter-chat.js
// Chat for buyer ↔ seller about a product (barter-friendly)

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

/** ---------- DOM refs (shop.html 已经提供) ---------- */
const modal = document.getElementById("barterChatModal");
const titleEl = document.getElementById("barterChatTitle");
const infoEl = document.getElementById("barterChatProductInfo");
const listEl = document.getElementById("barterChatMessages");
const offerInput = document.getElementById("barterOfferInput");
const textInput = document.getElementById("barterTextInput");
const hintEl = document.getElementById("barterChatHint");
const sendBtn = document.getElementById("barterSendBtn");
const closeBtn = document.getElementById("barterChatClose");

/** ---------- runtime state ---------- */
let currentUser = null;
let currentThread = null;       // { id, product_id, buyer_uid, seller_uid, ... }
let messagesUnsub = null;       // snapshot unsubscribing function
let currentProduct = null;      // { id, name, image_url, seller_uid, seller_name, ... }

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
  // 等下一帧等 DOM 插完
  requestAnimationFrame(() => {
    listEl.scrollTop = listEl.scrollHeight;
  });
}

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

  const parts = [];
  if (typeof msg.extra_cents === "number" && msg.extra_cents > 0) {
    parts.push(`💰 Extra: ${fmtMoneyFromCents(msg.extra_cents)}`);
  }
  if (msg.text && msg.text.trim()) {
    parts.push(msg.text.trim());
  }
  bubble.textContent = parts.length ? parts.join("\n") : "(empty)";

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

function clearList() {
  listEl.innerHTML = "";
}

/** ---------- Firestore helpers ---------- */

/**
 * 根据 product 和当前用户，生成稳定的 threadId：
 * 规则：{productId}_{buyerUid}_{sellerUid}（buyer/seller 顺序固定）
 */
function computeThreadId(productId, buyerUid, sellerUid) {
  return `${productId}_${buyerUid}_${sellerUid}`;
}

/**
 * 确保线程存在；若没有则创建。
 * 返回 thread 文档对象（含 id）。
 *
 * Firestore 规则里你已经写了：
 * - 线程创建需要字段：product_id / buyer_uid / seller_uid
 * - 只有参与者（buyer 或 seller）才能创建/读写
 */
async function ensureThread(product) {
  const productId = product.id;
  const sellerUid = product.seller_uid;
  const buyerUid = currentUser.uid;

  const threadId = computeThreadId(productId, buyerUid, sellerUid);
  const threadRef = doc(db, "barter_threads", threadId);
  const snap = await getDoc(threadRef);

  if (!snap.exists()) {
    // 创建
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
      participants: [buyerUid, sellerUid],
      // 你 rules 里 validThreadCreate() 仅要求上面三项和参与者校验，这里都满足
    };
    await setDoc(threadRef, base);
    return { id: threadId, ...base };
  }

  return { id: threadId, ...snap.data() };
}

/**
 * 订阅消息子集合
 */
function subscribeMessages(thread) {
  if (messagesUnsub) {
    messagesUnsub();
    messagesUnsub = null;
  }

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

/**
 * 发送一条消息
 */
async function sendMessage(text, extraCents) {
  if (!currentThread || !currentUser) return;

  const payload = {
    text: (text || "").trim(),
    extra_cents: typeof extraCents === "number" ? extraCents : 0,
    sender_uid: currentUser.uid,
    sender_email: currentUser.email || "",
    created_at: serverTimestamp(),
  };

  const msgsCol = collection(db, "barter_threads", currentThread.id, "messages");
  await addDoc(msgsCol, payload);

  // 更新 thread 概要
  await updateDoc(doc(db, "barter_threads", currentThread.id), {
    updated_at: serverTimestamp(),
    last_message: payload.text || (payload.extra_cents > 0 ? `Extra ${fmtMoneyFromCents(payload.extra_cents)}` : ""),
    last_sender_uid: payload.sender_uid,
    last_extra_cents: payload.extra_cents || 0,
  });
}

/** ---------- UI open/close ---------- */

function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex"); // 你的 CSS 已经提供 .flex {display:flex}
  // 给一点动画延迟体验更好（可选）
  requestAnimationFrame(() => scrollToBottom());
}

function closeModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  if (messagesUnsub) {
    messagesUnsub();
    messagesUnsub = null;
  }
  currentThread = null;
  currentProduct = null;
  textInput.value = "";
  offerInput.value = "";
  hintEl.textContent = "";
}

/** ---------- Main entry exposed to window ---------- */

/**
 * openForProduct(productOrId[, options])
 * - productOrId: 传入完整 product 对象（推荐）；或 productId（此时会自动读取 /products/{id}）
 * - options: { buyerUid?: string } 预留给卖家想指定某个 buyer 时候的场景（此版暂不使用）
 */
async function openForProduct(productOrId, options = {}) {
  try {
    if (!ensureLoggedIn()) return;

    // 1) 获取 product
    let product = null;
    if (typeof productOrId === "string") {
      const pRef = doc(db, "products", productOrId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) {
        alert("Product not found.");
        return;
      }
      product = { id: pSnap.id, ...pSnap.data() };
    } else if (productOrId && typeof productOrId === "object") {
      product = productOrId;
    } else {
      alert("Invalid product.");
      return;
    }

    currentProduct = product;

    // 2) 校验参与者（买家 / 卖家皆可打开）
    const sellerUid = product.seller_uid;
    if (!sellerUid) {
      alert("Seller not found on this product.");
      return;
    }

    // 3) 确保 thread 存在
    currentThread = await ensureThread(product);

    // 4) 准备 UI
    titleEl.textContent = "Barter Chat";
    infoEl.textContent = `Product: ${product.name || "(no name)"} • Seller: ${product.seller_name || product.seller_email || product.seller_uid || ""}`;
    hintEl.textContent = currentUser.uid === sellerUid
      ? "You are chatting as the seller."
      : "You are chatting as the buyer.";

    // 5) 订阅消息 & 打开
    subscribeMessages(currentThread);
    openModal();
  } catch (err) {
    console.error("openForProduct error:", err);
    alert(err?.message || "Failed to open chat.");
  }
}

/** ---------- events ---------- */

// 发送按钮
sendBtn?.addEventListener("click", async () => {
  if (!currentThread) return;

  const text = (textInput.value || "").trim();
  const extraRaw = (offerInput.value || "").trim();
  const extraCents = extraRaw ? parseInt(extraRaw, 10) : 0;

  if (!text && (!extraCents || Number.isNaN(extraCents))) {
    alert("请输入消息，或者填写额外补多少钱（单位：分）");
    return;
  }

  try {
    sendBtn.disabled = true;
    await sendMessage(text, Number.isNaN(extraCents) ? 0 : extraCents);
    textInput.value = "";
    // 可选：不清空价钱，方便连续报价；如需清空，取消下一行注释
    // offerInput.value = "";
    await sleep(50);
    scrollToBottom();
  } catch (e) {
    console.error("send error:", e);
    alert(e?.message || "Failed to send message.");
  } finally {
    sendBtn.disabled = false;
  }
});

// 关闭按钮 / 点击遮罩（只给 closeBtn，避免误触背景导致输入丢失）
closeBtn?.addEventListener("click", closeModal);

/** ---------- auth bootstrap ---------- */
onAuthStateChanged(auth, (u) => {
  currentUser = u || null;
});

/** ---------- export to window ---------- */
window.BarterChat = {
  openForProduct,
  // 预留给后续：openByThreadId(threadId) / openSellerWith(buyerUid) 等
};
