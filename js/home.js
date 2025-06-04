// home.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 获取页面元素
const emailSpan = document.getElementById("user-email");
const avatarSpan = document.getElementById("avatar");
const membershipBanner = document.getElementById("membership-banner");
const userProducts = document.getElementById("user-products");

// 检查用户登录状态
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const email = user.email || "Anonymous";
    emailSpan.innerText = email;
    avatarSpan.innerText = email.charAt(0).toUpperCase();

    // 检查会员信息
    const membershipRef = doc(db, "memberships", user.uid);
    const membershipSnap = await getDoc(membershipRef);
    const paidUntil = membershipSnap.exists() ? membershipSnap.data().paid_until?.seconds * 1000 : 0;

    if (!paidUntil || paidUntil < Date.now()) {
      membershipBanner.innerHTML = `<p><strong>You are not a member.</strong></p><button class="btn-member">Become a Member</button>`;
    } else {
      membershipBanner.innerHTML = `<p><strong>You are a member until:</strong> ${new Date(paidUntil).toLocaleDateString()}</p>`;
    }

    // 加载用户上传的产品
    const q = query(collection(db, "products"), where("owner_uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      userProducts.innerHTML = "<p>You haven't uploaded any products yet.</p>";
    } else {
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <h3>${data.name}</h3>
          <img src="${data.image_url}" alt="${data.name}" class="product-img" />
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Price:</strong> $${data.price}</p>
        `;
        userProducts.appendChild(div);
      });
    }
  } else {
    // 未登录则跳转至登录页
    window.location.href = "/login.html";
  }
});
