import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const avatarEl = document.getElementById("user-avatar");
const logoutLink = document.getElementById("logout-link");
const membershipBtn = document.getElementById("membership-btn");
const productsDiv = document.getElementById("my-products");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // 显示头像（若有）
  if (user.photoURL) {
    avatarEl.src = user.photoURL;
  }

  // 加载用户是否为会员
 // 加载用户是否为会员
try {
  const memberRef = doc(db, "memberships", user.uid);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) {
    const paidUntil = memberSnap.data().paid_until?.seconds * 1000;
    if (paidUntil > Date.now()) {
      membershipBtn.innerText = "✅ Already a Member";
      membershipBtn.disabled = true;
    } else {
      const cta = document.createElement("a");
      cta.href = "/membership.html";
      cta.innerText = "🔑 Become a Member to Upload and Bid";
      cta.className = "inline-block mt-4 bg-yellow-400 text-black px-4 py-2 rounded font-bold hover:bg-yellow-500 transition";
      document.querySelector("main").appendChild(cta);
    }
  }
} catch (e) {
  console.error("Failed to load membership:", e);
}

  try {
  const favsCol = collection(db, "users", user.uid, "favorites");
  const favsSnap = await getDocs(favsCol);
  const favIds = favsSnap.docs.map(docSnap => docSnap.id);

  const favsDiv = document.getElementById("my-favorites");

  if (favIds.length === 0) {
    favsDiv.innerHTML = "<p>You haven't favorited any products yet.</p>";
  } else {
    favsDiv.innerHTML = ""; // 清空
    for (const productId of favIds) {
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const data = productSnap.data();
        const item = document.createElement("div");
        item.className = "product";
        item.innerHTML = `
          <h3>${data.name}</h3>
          <img src="${data.image_url}" alt="${data.name}" />
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Price:</strong> $${data.price}</p>
          <p><strong>Current Bid:</strong> $${data.current_bid || "N/A"}</p>
        `;
        favsDiv.appendChild(item);
      }
    }
  }
} catch (err) {
  console.error("Failed to load favorites:", err);
  document.getElementById("my-favorites").innerText = "Failed to load your favorites.";
}

 // 加载用户收藏的商品
try {
  const favsCol = collection(db, "users", user.uid, "favorites");
  const favsSnap = await getDocs(favsCol);
  const favIds = favsSnap.docs.map(docSnap => docSnap.id);

  const favsDiv = document.getElementById("my-favorites");

  if (favIds.length === 0) {
    favsDiv.innerHTML = "<p>You haven't favorited any products yet.</p>";
  } else {
    favsDiv.innerHTML = ""; // 清空
    for (const productId of favIds) {
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const data = productSnap.data();
        const item = document.createElement("div");
        item.className = "product";
        item.innerHTML = `
          <h3>${data.name}</h3>
          <img src="${data.image_url}" alt="${data.name}" />
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Price:</strong> $${data.price}</p>
          <p><strong>Current Bid:</strong> $${data.current_bid || "N/A"}</p>
        `;
        favsDiv.appendChild(item);
      }
    }
  }
} catch (err) {
  console.error("Failed to load favorites:", err);
  document.getElementById("my-favorites").innerText = "Failed to load your favorites.";
}


// 退出登录按钮
logoutLink.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = "/login.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

// 成为会员按钮逻辑（跳转/引导）
membershipBtn.addEventListener("click", () => {
  alert("To become a member, please contact admin or submit payment info.");
});
