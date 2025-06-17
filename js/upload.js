import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// DOM 元素
const form = document.getElementById("upload-form");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");

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
  const docRef = doc(db, "memberships", user.uid);
  const docSnap = await getDoc(docRef);
  const paidUntil = docSnap.data()?.paid_until?.seconds * 1000;

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
  submitBtn.disabled = true;
submitBtn.innerText = "Uploading...";

  if (!currentUser || !isMember) {
    message.innerText = "⛔️ Only logged-in members can upload.";
    return;
  }

  const name = form["name"].value.trim();
  const price = parseFloat(form["price"].value);
  const description = form["description"].value.trim();
  const imageUrl = form["image_url"].value.trim();
 const endsAtRaw = form["ends_at"].value;

if (!name || isNaN(price) || !description || !imageUrl || !endsAtRaw) {
  message.innerText = "❌ Please fill in all fields correctly.";
  return;
}

const endsAt = new Date(endsAtRaw);

// ✅ 先定义变量
const shippingEnabled = form["shipping_enabled"].checked;
const pickupEnabled = form["pickup_enabled"].checked;
const shippingFee = shippingEnabled ? parseFloat(form["shipping_fee"].value) || 0 : 0;
const pickupAddress = pickupEnabled ? form["pickup_address"].value.trim() : "";

// ✅ 再进行校验
if (shippingEnabled && isNaN(parseFloat(form["shipping_fee"].value))) {
  message.innerText = "❌ Please enter a valid shipping fee.";
  submitBtn.disabled = false;
  submitBtn.innerText = "✅ Upload Product";
  return;
}

if (pickupEnabled && !pickupAddress) {
  message.innerText = "❌ Please enter a pickup location.";
  submitBtn.disabled = false;
  submitBtn.innerText = "✅ Upload Product";
  return;
}

// ✅ 最后执行上传
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
  shipping_enabled: shippingEnabled,
  shipping_fee: shippingFee,
  pickup_enabled: pickupEnabled,
  pickup_address: pickupAddress,
  created_at: serverTimestamp()
});

  form.reset();
    message.style.color = "green";
    message.innerText = "✅ Product uploaded successfully!";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
  } catch (err) {
    console.error("Upload failed:", err);
    message.style.color = "red";
    message.innerText = "❌ Upload failed. Try again.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
  }
});
