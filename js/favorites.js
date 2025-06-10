import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const avatarEl = document.getElementById("user-avatar");
const logoutLink = document.getElementById("logout-link");
const favoritesDiv = document.getElementById("favorites-list");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // 显示头像（若有）
  if (user.photoURL) {
    avatarEl.src = user.photoURL;
  }

  // 加载我的收藏
  try {
    const favsCol = collection(db, "users", user.uid, "favorites");
    const favsSnap = await getDocs(favsCol);
    const favIds = favsSnap.docs.map(docSnap => docSnap.id);

    if (favIds.length === 0) {
      favoritesDiv.innerHTML = "<p>You haven't favorited any products yet.</p>";
    } else {
      favoritesDiv.innerHTML = ""; // 清空
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
          favoritesDiv.appendChild(item);
        }
      }
    }
  } catch (err) {
    console.error("Failed to load favorites:", err);
    favoritesDiv.innerText = "Failed to load your favorites.";
  }
});

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
