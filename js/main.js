console.log("✅ main.js started");

import { db, auth } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const usernameEl = document.getElementById("username");
const avatarEl = document.getElementById("avatar");
const productListEl = document.getElementById("product-list");
const membershipStatusEl = document.getElementById("membership-status");
const becomeMemberBtn = document.getElementById("become-member");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("👤 Logged in user:", user.email);
    usernameEl.innerText = user.email;
    avatarEl.src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.uid}`; // 头像图标

    // 检查会员状态
    const membershipRef = doc(db, "memberships", user.uid);
    const membershipSnap = await getDoc(membershipRef);
    let isMember = false;

    if (membershipSnap.exists()) {
      const paidUntil = membershipSnap.data().paid_until;
      if (paidUntil?.seconds * 1000 > Date.now()) {
        isMember = true;
      }
    }

    membershipStatusEl.innerText = isMember
      ? "✅ You are a current member."
      : "❌ You are not a member.";

    if (!isMember) {
      becomeMemberBtn.style.display = "inline-block";
    }

    // 加载用户上传的商品
    const q = query(collection(db, "products"), where("uploader_uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    productListEl.innerHTML = '';

    if (querySnapshot.empty) {
      productListEl.innerHTML = '<p>No products uploaded yet.</p>';
    } else {
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = document.createElement("div");
        item.className = "product";
        item.innerHTML = `
          <h3>${data.name}</h3>
          <img src="${data.image_url}" alt="${data.name}" width="200" />
          <p><strong>Price:</strong> $${data.price}</p>
          <p><strong>Description:</strong> ${data.description}</p>
        `;
        productListEl.appendChild(item);
      });
    }
  } else {
    console.warn("⚠️ No user logged in. Redirecting to login...");
    window.location.href = "/login.html";
  }
});

// 退出登录功能
document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});
