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

  // 加载用户上传的商品
  try {
    const q = query(collection(db, "products"), where("uploader_uid", "==", user.uid));
    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      productsDiv.innerHTML = "<p>You haven't uploaded any products yet.</p>";
    } else {
      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        const item = document.createElement("div");
        item.className = "product";
        item.innerHTML = `
          <h3>${data.name}</h3>
          <img src="${data.image_url}" alt="${data.name}" />
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Price:</strong> $${data.price}</p>
          <p><strong>Current Bid:</strong> $${data.current_bid || "N/A"}</p>
        `;
        productsDiv.appendChild(item);
      });

// 🔽 插入在 forEach(docSnap => { ... }) 内部，每个商品 item 创建完之后：
loadReviewsForProduct(user.uid, docSnap.id, item);

// 🔽 添加这个函数在 onAuthStateChanged 外面或下面都可以：
async function loadReviewsForProduct(sellerUid, productId, item) {
  try {
    const reviewQ = query(
      collection(db, "reviews"),
      where("seller_uid", "==", sellerUid),
      where("product_id", "==", productId)
    );
    const reviewSnap = await getDocs(reviewQ);
    const reviews = [];
    reviewSnap.forEach(r => reviews.push(r.data()));

    const good = reviews.filter(r => r.rating === "good");
    const bad = reviews.filter(r => r.rating === "bad");
    const total = reviews.length;
    const rate = total > 0 ? Math.round((good.length / total) * 100) : 0;

    const summary = document.createElement("p");
    summary.innerHTML = `👍 Good: ${good.length} | 👎 Bad: ${bad.length} | ⭐️ Good Rate: ${rate}%`;
    summary.style.fontWeight = "bold";
    item.appendChild(summary);

    if (total > 0) {
      const commentBox = document.createElement("div");
      commentBox.style.marginTop = "0.5em";

      const visibleCount = 3;
      const showReviews = reviews.slice(0, visibleCount);
      showReviews.forEach(r => {
        const p = document.createElement("p");
        p.innerText = `💬 ${r.review_text || "(No comment)"} – (${r.rating.toUpperCase()})`;
        commentBox.appendChild(p);
      });

      if (total > visibleCount) {
        const toggleBtn = document.createElement("button");
        toggleBtn.innerText = "Show More";
        toggleBtn.style.marginTop = "0.5em";
        toggleBtn.onclick = () => {
          commentBox.innerHTML = "";
          reviews.forEach(r => {
            const p = document.createElement("p");
            p.innerText = `💬 ${r.review_text || "(No comment)"} – (${r.rating.toUpperCase()})`;
            commentBox.appendChild(p);
          });
          toggleBtn.remove();
        };
        item.appendChild(toggleBtn);
      }

      item.appendChild(commentBox);
    }
  } catch (e) {
    console.warn("⚠️ Failed to load reviews:", e);
  }
}

      
    }
  } catch (err) {
    console.error("Failed to load user products:", err);
    productsDiv.innerText = "Failed to load your products.";
  }

  // 成为会员按钮逻辑
  membershipBtn.addEventListener("click", () => {
    alert("To become a member, please contact admin or submit payment info.");
  });

});  // ✅ onAuthStateChanged 正确结束！！！

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
