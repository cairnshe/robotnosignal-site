// /js/my-chats.js
// List all threads involving current user; click to open the chat modal.

import { db, auth } from "/js/firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const listEl = document.getElementById("chatList");
const emptyEl = document.getElementById("emptyHint");

function ensureLoggedIn(u) {
  if (!u) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

function clearList() { listEl.innerHTML = ""; }

function fmtTime(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  return d.toLocaleString();
}

function renderItem(t, selfUid) {
  const otherEmail = (selfUid === t.seller_uid) ? (t.buyer_email || t.buyer_uid) : (t.seller_email || t.seller_uid);
  const div = document.createElement("div");
  div.className = "item";

  const img = document.createElement("img");
  img.src = t.product_image || "/placeholder.png";
  img.alt = t.product_name || "";
  div.appendChild(img);

  const mid = document.createElement("div");
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = t.product_name || "(no name)";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `With: ${otherEmail || ""} • Last: ${t.last_message || (t.last_extra_cents ? `Extra $${(t.last_extra_cents/100).toFixed(2)}` : "")}`;
  mid.appendChild(title);
  mid.appendChild(meta);
  div.appendChild(mid);

  const right = document.createElement("div");
  right.className = "meta";
  right.textContent = fmtTime(t.updated_at || t.last_message_at);
  div.appendChild(right);

  div.onclick = () => {
    // 通过 threadId 打开聊天弹窗（使用 barter-chat.js 暴露的 API）
    window.BarterChat?.openByThreadId(t.id);
  };

  return div;
}

onAuthStateChanged(auth, (user) => {
  if (!ensureLoggedIn(user)) return;

  // 只取当前用户参与的线程
  const qThreads = query(
    collection(db, "barter_threads"),
    where("participants", "array-contains", user.uid),
    orderBy("updated_at", "desc")
  );

  onSnapshot(qThreads, (qs) => {
    clearList();
    if (qs.empty) {
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";
    qs.forEach((d) => {
      const t = { id: d.id, ...d.data() };
      listEl.appendChild(renderItem(t, user.uid));
    });
  }, (err) => {
    console.error("Load threads error:", err);
    emptyEl.textContent = "Failed to load chats.";
    emptyEl.style.display = "block";
  });
});
