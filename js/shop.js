console.log("✅ shop.html script started");

import { db, auth } from '/js/firebase-config.js';
console.log("✅ Firebase modules imported", auth);

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

console.log("📡 Listening for auth state change...");

let currentUser = null;
let isMember = false;
const list = document.getElementById('product-list');

function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function startCountdown(elementId, endTime) {
  const el = document.getElementById(elementId);

  // 新增：获取 input 和 button 元素
  const productId = elementId.replace('cd-', '');
  const bidInput = document.getElementById(`input-${productId}`);
  const bidButton = document.getElementById(`bid-btn-${productId}`);

  const timer = setInterval(() => {
    const now = Date.now();
    const diff = endTime - now;

    if (diff <= 0) {
      clearInterval(timer);
      el.innerText = 'Expired';

      // 禁用输入框
      if (bidInput) {
        bidInput.disabled = true;
      }

      // 禁用按钮 + 改样式
      if (bidButton) {
        bidButton.disabled = true;
        bidButton.textContent = 'Auction ended';
        bidButton.style.backgroundColor = '#888'; // 灰色
        bidButton.style.cursor = 'not-allowed';
      }

    } else {
      el.innerText = formatCountdown(diff);
    }
  }, 1000);
}


onAuthStateChanged(auth, async (user) => {
  console.log("👀 onAuthStateChanged fired. User:", user);
  currentUser = user;
  isMember = false;

  if (user) {
    console.log("🔍 UID is:", user.uid);

    currentUser = user;
    const emailSpan = document.getElementById("user-email");
    let prefix = "";
    let memberUntilText = "";
    let tooltipText = "";

    try {
      const ref = doc(db, "memberships", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const paidUntil = snap.data().paid_until;
        console.log("📅 paid_until timestamp:", paidUntil);
        if (paidUntil?.seconds * 1000 > Date.now()) {
          isMember = true;
          prefix = "👑 ";
          const dateObj = new Date(paidUntil.seconds * 1000);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          memberUntilText = `(Member until: ${year}-${month}-${day})`;

        }
      } else {
        console.warn("⚠️ No membership document found for this user.");
      }
    } catch (e) {
      console.error("❌ Error checking membership:", e);
    }

   if (emailSpan) {
  tooltipText = memberUntilText ? `title="${memberUntilText.trim()}"` : "";
  emailSpan.innerHTML = `${prefix}Welcome Back, <span ${tooltipText} style="text-decoration: underline dotted; cursor: help;">${user.email}</span>!`;
}


    console.log("✅ Current user:", currentUser?.email || "None");
    console.log("✅ Is member:", isMember);

    // ✅ 只有登录后才加载产品
    loadProducts();
   } else {
    console.warn("⚠️ User not logged in.");
    const list = document.getElementById('product-list');
    list.innerHTML = `
  <div style="text-align: center; margin-top: 3rem;">
    <p style="color: red; font-size: 1.2rem; font-weight: bold;">❗ Please log in to view products.</p>
    <p style="margin-top: 1.5rem; font-size: 1.1rem;">
      Already Have An Account? <a href="/login" style="color: #007bff; text-decoration: underline;">Login now!</a>
    </p>
    <p style="margin-top: 0.5rem; font-size: 1.1rem;">
      Haven't Registered Yet? <a href="/signup" style="color: #007bff; text-decoration: underline;">Register For Free Now!</a>
    </p>
  </div>
`;

} 

}); 


async function loadProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    console.log("📦 Raw Firestore docs:", querySnapshot.size);
    const products = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });

    products.sort((a, b) => a.ends_at?.seconds - b.ends_at?.seconds);
    const now = Date.now();
    const ongoing = products.filter(p => p.ends_at?.seconds * 1000 > now);

    // ✅ 搜索输入框引用
    const searchInput = document.getElementById("search-input");

    // ✅ 渲染函数封装
    function renderProducts(filtered) {
      list.innerHTML = '';
      filtered.forEach((product) => {
        const endsAt = product.ends_at.seconds * 1000;
        const timeLeft = endsAt - now;
        const item = document.createElement('div');
        item.className = 'product';

        const bids = product.bids || [];
        const highest = bids.length === 0 ? 0 : (product.current_bid || product.starting_bid || 0);

        item.innerHTML = `
          <h2>${product.name}</h2>
          <img src="${product.image_url}" alt="${product.name}" />
          <p><strong>Starting Price:</strong> $${product.price}</p>
         <p><strong>Current Bid:</strong> $${highest}</p>
          <p>${product.description}</p>
          <p><strong>Seller:</strong> ${product.seller_name}</p>
          <p><strong>Ends in:</strong> <span class="countdown" id="cd-${product.id}">${formatCountdown(timeLeft)}</span></p>
          <div class="bid-input">
           <input type="number" placeholder="Enter your MAX bid..." id="input-${product.id}" />
            <button id="bid-btn-${product.id}" onclick="placeBid('${product.id}', ${highest})">Place Bid</button>
          </div>
          <p class="error" id="error-${product.id}"></p>
          <div class="history">
            <a href="#" onclick="toggleHistory('${product.id}'); return false;">Show Bid History</a>
            <ul id="history-${product.id}" style="display:none; margin-top:0.5rem;"></ul>
          </div>
        `;
        list.appendChild(item);
        startCountdown(`cd-${product.id}`, endsAt);

        const historyEl = item.querySelector(`#history-${product.id}`);
        if (bids.length) {
          bids.slice().reverse().forEach(b => {
            const li = document.createElement('li');
            const date = new Date(b.timestamp?.seconds * 1000 || Date.now());
            li.innerText = `${b.bidder || 'Anonymous'} bid $${b.current_effective_bid || b.amount || 0} (max $${b.max_bid || b.amount || 0}) at ${date.toLocaleString()}`;
            historyEl.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.innerText = "No bids yet.";
          historyEl.appendChild(li);
        }

        const input = item.querySelector(`#input-${product.id}`);
        const btn = item.querySelector('button');
        const err = item.querySelector(`#error-${product.id}`);

        if (!isMember) {
          input.disabled = true;
          btn.disabled = true;
          err.innerHTML = `<a href='/login'>Log in</a> / <a href='/signup'>Sign up</a> before bidding!`;
        } else {
          input.disabled = false;
          btn.disabled = false;
          err.innerHTML = '';
        }
      });
    }

    // ✅ 初始渲染
    renderProducts(ongoing);

    // ✅ 搜索监听器
    searchInput.addEventListener("input", () => {
      const keyword = searchInput.value.trim().toLowerCase();
      const filtered = ongoing.filter(p =>
        p.name?.toLowerCase().includes(keyword) ||
        p.description?.toLowerCase().includes(keyword) ||
        p.seller_name?.toLowerCase().includes(keyword) ||
        p.seller_email?.toLowerCase().includes(keyword)
      );
      renderProducts(filtered);
    });

  } catch (error) {
    console.error("❌ Error loading products:", error);
    list.innerText = "Failed to load products.";
  }
}

window.placeBid = async function(productId, currentBid) {
  const input = document.getElementById(`input-${productId}`);
  const error = document.getElementById(`error-${productId}`);
  const maxBid = parseFloat(input.value);

  let minIncrement = 1;
  if (currentBid >= 100) {
    minIncrement = 4;
  } else if (currentBid >= 50) {
    minIncrement = 2;
  }

  if (isNaN(maxBid)) {
    error.innerText = `Please enter a valid number.`;
    return;
  }

  try {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);
    const productData = productSnap.data();

    const bids = productData.bids || [];
    const startingBid = productData.starting_bid || 0;
    const highestMaxBid = bids.length ? Math.max(...bids.map(b => b.max_bid || b.amount || 0)) : startingBid;
    const highestEffectiveBid = bids.length === 0 ? 0 : (productData.current_bid || startingBid || 0);
    const currentBidder = productData.current_bidder || null;

    let newEffectiveBid = highestEffectiveBid;
    let newBidder = currentBidder;

    // ✅ 1️⃣ 特别处理首 bid：必须 ≥ starting_bid + minIncrement
    if (bids.length === 0) {
      const firstValidBid = startingBid + minIncrement;
      if (maxBid < firstValidBid) {
        error.innerText = `Your first bid must be at least $${firstValidBid}.`;
        return;
      }
      // 合法首 bid
      newEffectiveBid = firstValidBid;
      newBidder = currentUser?.email || "anonymous";
    } else {
      // ✅ 2️⃣ 判断是否自己是当前领先者
      if (currentBidder === (currentUser?.email || "anonymous")) {
        if (maxBid <= highestMaxBid) {
          error.innerText = `Your new MAX bid must be higher than your current MAX bid ($${highestMaxBid}).`;
          return;
        }
        // 自己领先 → 只更新 maxBid，不加 current_bid
        newEffectiveBid = highestEffectiveBid;
        newBidder = currentBidder;
      } else {
        // ✅ 3️⃣ 正常竞价流程
        if (maxBid <= highestEffectiveBid) {
          error.innerText = `Your MAX bid must be greater than current bid ($${highestEffectiveBid}).`;
          return;
        }

        if (maxBid > highestMaxBid) {
          // 你超过所有人 → 出别人 maxBid + minIncrement，最多到你的 maxBid
          newEffectiveBid = Math.min(maxBid, highestMaxBid + minIncrement);
          newBidder = currentUser?.email || "anonymous";
        } else if (maxBid === highestMaxBid) {
          // 平 maxBid，触发规则 → 你后手 → 出 maxBid，当前 effectiveBid + minIncrement
          newEffectiveBid = Math.min(maxBid, highestEffectiveBid + minIncrement);
          newBidder = currentUser?.email || "anonymous";
        } else {
          // 你 maxBid 不如之前最高 → 只能把 current_bid 拉高到你能出的最高
          if (maxBid >= highestEffectiveBid + minIncrement) {
            newEffectiveBid = highestEffectiveBid + minIncrement;
            // current_bidder 不变
            newBidder = (newEffectiveBid > highestEffectiveBid) ? (currentUser?.email || "anonymous") : currentBidder;
          } else {
            // 出价无效，不会变 current_bid
            newEffectiveBid = highestEffectiveBid;
            newBidder = currentBidder;
          }
        }
      }
    }

    // ✅ 更新 Firestore
    await updateDoc(productRef, {
      current_bid: newEffectiveBid,
      current_bidder: newBidder,
      bids: arrayUnion({
        max_bid: maxBid,
        current_effective_bid: newEffectiveBid,
        bidder: currentUser?.email || "anonymous",
        timestamp: new Date()
      })
    });

    error.innerText = '';
    input.value = '';
    location.reload();
  } catch (err) {
    console.error(err);
    error.innerText = "Error placing bid.";
  }
};

window.toggleHistory = function(id) {
  const el = document.getElementById(`history-${id}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
