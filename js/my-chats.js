// /js/my-chats.js
console.log("✅ my-chats.js loaded");

import { auth, db } from '/js/firebase-config.js';
import {
  collection, query, where, getDocs, doc, getDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const listEl = document.getElementById('list');
const searchInput = document.getElementById('searchInput');

let threads = [];
let productsById = {};
let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    listEl.innerHTML = `<div class="empty">Please <a href="/login.html">log in</a> to view your chats.</div>`;
    return;
  }
  currentUser = user;
  await loadThreads();
  render();
});

async function loadThreads() {
  listEl.innerHTML = `<div class="empty">Loading…</div>`;
  try {
    const buyerQ = query(
      collection(db, "barter_threads"),
      where("buyer_uid", "==", currentUser.uid)
    );
    const sellerQ = query(
      collection(db, "barter_threads"),
      where("seller_uid", "==", currentUser.uid)
    );

    const [buyerSnap, sellerSnap] = await Promise.all([getDocs(buyerQ), getDocs(sellerQ)]);

    const map = new Map();
    buyerSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    sellerSnap.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
    threads = Array.from(map.values());

    // 预抓取所有涉及的产品
    const productIds = Array.from(new Set(threads.map(t => t.product_id).filter(Boolean)));
    const fetches = productIds.map(async pid => {
      const psnap = await getDoc(doc(db, "products", pid));
      if (psnap.exists()) productsById[pid] = { id: psnap.id, ...psnap.data() };
    });
    await Promise.all(fetches);

    // 排序（last_message_at 优先，其次 created_at）
    threads.sort((a, b) => {
      const la = (a.last_message_at?.seconds || 0);
      const lb = (b.last_message_at?.seconds || 0);
      if (lb !== la) return lb - la;
      const ca = (a.created_at?.seconds || 0);
      const cb = (b.created_at?.seconds || 0);
      return cb - ca;
    });

  } catch (e) {
    console.error("Load threads error:", e);
    listEl.innerHTML = `<div class="empty">Failed to load. Please retry.</div>`;
  }
}

function render() {
  const kw = (searchInput?.value || "").trim().toLowerCase();

  const filtered = threads.filter(t => {
    const prod = productsById[t.product_id] || {};
    const title = (prod.name || "").toLowerCase();
    const last = (t.last_message_text || "").toLowerCase();
    const otherEmail = (t.buyer_email === currentUser.email ? t.seller_email : t.buyer_email) || "";
    const other = (otherEmail || "").toLowerCase();
    if (!kw) return true;
    return title.includes(kw) || last.includes(kw) || other.includes(kw) || (t.product_id || "").includes(kw);
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty">No chats${kw ? ` for “${kw}”` : ""}.</div>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach(t => {
    const prod = productsById[t.product_id] || {};
    const thumb = prod.image_url || "";
    const title = prod.name || "(Product)";
    const whoAmI = (t.buyer_uid === currentUser.uid) ? "buyer" : "seller";
    const otherName = (whoAmI === "buyer") ? (t.seller_email || t.seller_uid) : (t.buyer_email || t.buyer_uid);

    const lastAt = t.last_message_at?.seconds ? new Date(t.last_message_at.seconds * 1000) : null;
    const lastLine = t.last_message_text ? t.last_message_text : "(no message yet)";
    const barterLocked = prod.barter_locked === true;

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img class="thumb" src="${thumb}" alt="">
      <div class="meta">
        <div class="title">${title}</div>
        <div class="sub">with: ${otherName || "—"}</div>
        <div class="lastline">
          <span class="sub" title="${lastAt ? lastAt.toLocaleString() : ""}">
            ${lastAt ? lastAt.toLocaleString() : "—"} · ${escapeHtml(lastLine)}
          </span>
          <div class="row">
            ${barterLocked ? `<span class="pill">🔒 locked for barter</span>` : ``}
            <button class="btn" data-open="${t.id}">Open Chat</button>
          </div>
        </div>
      </div>
    `;
    listEl.appendChild(card);

    card.querySelector('button[data-open]')?.addEventListener('click', () => openChat(t));
  });
}

searchInput?.addEventListener('input', () => render());

async function openChat(thread) {
  // 我们用已有的 openForProduct。先确保有产品对象。
  let prod = productsById[thread.product_id];
  if (!prod) {
    const psnap = await getDoc(doc(db, "products", thread.product_id));
    if (psnap.exists()) prod = productsById[thread.product_id] = { id: psnap.id, ...psnap.data() };
  }
  if (!prod) {
    alert("Product not found.");
    return;
  }

  // 如果你的 barter-chat.js 提供 openForThread(threadId) 就改成那一版：
  // window.BarterChat.openForThread(thread.id);

  // 传入 product，同时附上已知的买卖双方，帮助聊天模块少查一次
  window.BarterChat?.openForProduct({
    id: prod.id,
    name: prod.name,
    image_url: prod.image_url,
    buyer_uid: thread.buyer_uid,
    seller_uid: thread.seller_uid,
    seller_email: thread.seller_email,
    buyer_email: thread.buyer_email,
  }, { threadId: thread.id });
}

// 小工具：简单 escape
function escapeHtml(s='') {
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
}
