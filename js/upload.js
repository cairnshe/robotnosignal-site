import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// DOM 元素
const form = document.getElementById("upload-form");
const message = document.getElementById("message");

// 用户状态
let currentUser = null;
let isMember = false;

// 登录与会员验证
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }
  currentUser = user;

  try {
    const docRef = await db.collection("memberships").doc(user.uid).get();
    const paidUntil = docRef.data()?.paid_until?.seconds * 1000;
    if (paidUntil && paidUntil > Date.now()) {
      isMember = true;
    } else {
      message.innerText = "⛔️ You must be a member to upload products.";
      form.style.display = "none";
    }
  } catch (e) {
    console.error("Failed to check membership:", e);
    message.innerText = "⚠️ Failed to verify membership.";
  }
});

// 提交处理
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.innerText = "";

  if (!currentUser || !isMember) {
    message.innerText = "⛔️ Only logged-in members can upload.";
    return;
  }

  const name = form["name"].value.trim();
  const price = parseFloat(form["price"].value);
  const description = form["description"].value.trim();
  const imageUrl = form["image_url"].value.trim();
  const endsIn = parseInt(form["ends_in"].value); // 以分钟计

  if (!name || isNaN(price) || !description || !imageUrl || isNaN(endsIn)) {
    message.innerText = "❌ Please fill in all fields correctly.";
    return;
  }

  try {
    const endsAt = new Date(Date.now() + endsIn * 60000); // 当前时间 + endsIn分钟
    await addDoc(collection(db, "products"), {
      name,
      price,
      description,
      image_url: imageUrl,
      uploader_uid: currentUser.uid,
      seller_name: currentUser.email || "Anonymous",
      starting_bid: price,
      bids: [],
      current_bid: price,
      ends_at: endsAt,
      created_at: serverTimestamp()
    });

    form.reset();
    message.style.color = "green";
    message.innerText = "✅ Product uploaded successfully!";
  } catch (err) {
    console.error("Upload failed:", err);
    message.style.color = "red";
    message.innerText = "❌ Upload failed. Try again.";
  }
});
