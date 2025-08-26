console.log("✅ shop.html script started");

import { db, auth } from '/js/firebase-config.js';
console.log("✅ Firebase modules imported", auth);

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";


import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

console.log("📡 Listening for auth state change...");

let currentUser = null;
let totalGood = 0;
let totalBad = 0;
let totalCount = 0;

let isMember = false;
const list = document.getElementById('product-list');

function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function startCountdown(elementId, endTime, productId, highestBid, currentBidder, bids) {
  const el = document.getElementById(elementId);

  // 获取 input 和 button 元素
  const bidInput = document.getElementById(`input-${productId}`);
  const bidButton = document.getElementById(`bid-btn-${productId}`);

  const timer = setInterval(async () => {
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
        bidButton.style.backgroundColor = '#888';
        bidButton.style.cursor = 'not-allowed';
      }

      // ✅ 自动写入 logic（管理员自动写入）
      try {
        if (currentUser?.uid === 'MT9pIgLkiadS3WbsLeui8zR3umd2') {
          console.log(`📝 Auto updating product ${productId}...`);

          const productRef = doc(db, "products", productId);
          const productSnap = await getDoc(productRef);
          const data = productSnap.data();

          if (!data.order_status) {
            const finalWinningBid = bids.length > 0 ? (data.current_bid || data.starting_bid || 0) : 0;
            const finalWinningBidder = bids.length > 0 ? (data.current_bidder || 'anonymous') : '';

            await updateDoc(productRef, {
              winning_bidder: finalWinningBidder,
              winning_bid_amount: finalWinningBid,
              order_status: finalWinningBidder ? "pending_payment" : "",
              payment_info: {}
            });

            console.log(`✅ Product ${productId} updated with order_status.`);
          } else {
            console.log(`ℹ️ Product ${productId} already has order_status: ${data.order_status}`);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to auto update product ${productId}:`, err);
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
  <div style="text-align: right; font-size: 0.85rem; color: #666;">
    ${
      product.shipping_enabled && product.pickup_enabled
        ? `Shipping & Pickup available (pickup at ${product.pickup_address?.city || 'Unknown'}, ${product.pickup_address?.province || 'Unknown'}, ${product.pickup_address?.country || 'Unknown'})<br>Shipping Fee: $${product.shipping_fee?.toFixed(2) || '0.00'}`
        : product.shipping_enabled
        ? `Shipping only<br>Shipping Fee: $${product.shipping_fee?.toFixed(2) || '0.00'}`
        : product.pickup_enabled
        ? `Pickup only (at ${product.pickup_address?.city || 'Unknown'}, ${product.pickup_address?.province || 'Unknown'}, ${product.pickup_address?.country || 'Unknown'})`
        : `No delivery options`
    }
  </div>

  <h2>${product.name}</h2>
  <img src="${product.image_url}" alt="${product.name}" />
  <p><strong>Starting Price:</strong> $${product.price}</p>
  <p><strong>Current Bid:</strong> $${highest}</p>
  <p>${product.description}</p>
  <p><strong>Seller:</strong> ${product.seller_name}</p>
  <p><strong>Seller Address:</strong> ${product.shipping_address?.city || 'Unknown'}, ${product.shipping_address?.province || 'Unknown'}, ${product.shipping_address?.country || 'Unknown'}</p>
  <p><strong>Ends in:</strong> <span class="countdown" id="cd-${product.id}">${formatCountdown(timeLeft)}</span></p>

  <div class="bid-input">
    <input type="number" placeholder="Enter your MAX bid..." id="input-${product.id}" />
    <button id="bid-btn-${product.id}" onclick="placeBid('${product.id}', ${highest})">Place Bid</button>
    <button id="fav-btn-${product.id}" class="fav-btn" data-fav="false" onclick="toggleFavorite('${product.id}')">☆</button>
  </div>

  <p class="error" id="error-${product.id}"></p>

  <div class="history">
    <a href="#" onclick="toggleHistory('${product.id}'); return false;">Show Bid History</a>
    <ul id="history-${product.id}" style="display:none; margin-top:0.5rem;"></ul>
  </div>
`;

 list.appendChild(item);

// ✅ 插入这段判断是否锁定
if (product.barter_locked === true) {
  const bidInput = item.querySelector(`#input-${product.id}`);
  const bidBtn = item.querySelector(`#bid-btn-${product.id}`);

  if (bidInput) bidInput.disabled = true;
  if (bidBtn) {
    bidBtn.disabled = true;
    bidBtn.textContent = "🔒 Locked for Barter";
    bidBtn.style.backgroundColor = "#ccc";
    bidBtn.style.cursor = "not-allowed";
  }

  const lockNotice = document.createElement("p");
  lockNotice.textContent = "🔒 This item is locked for a barter transaction.";
  lockNotice.className = "text-sm text-red-600 font-medium mt-2";
  item.appendChild(lockNotice);

  const barterBtn = document.createElement("button");
barterBtn.textContent = "💬 Request Barter";
barterBtn.className = "mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700";
barterBtn.onclick = () => {
  document.getElementById(`barter-modal-${product.id}`).style.display = 'block';
};
item.appendChild(barterBtn);

  
 // === NEW: Barter / Chat 按钮（点击打开即时聊天） ===
const chatBtn = document.createElement("button");
chatBtn.textContent = "💬 Barter / Chat";
chatBtn.className = "mt-2 ml-2 px-3 py-1 bg-black text-white rounded hover:bg-gray-800";
chatBtn.onclick = () => {
  if (window.BarterChat?.openForProduct) {
    window.BarterChat.openForProduct(product.id);
  } else {
    console.warn("Chat module not loaded. Ensure /js/barter-chat.js is included after shop.js.");
    alert("Chat module not loaded.");
  }
};
item.appendChild(chatBtn);
// === NEW END ===
 
  
// Modal HTML
const modalHTML = `
  <div id="barter-modal-${product.id}" class="barter-modal" style="display:none; position:fixed; top:20%; left:50%; transform:translateX(-50%);
    background:white; padding:1rem; border:1px solid #ccc; border-radius:8px; z-index:1000; max-width:90%;">
    <h3 class="text-lg font-semibold mb-2">Barter Request for "${product.name}"</h3>

    <label for="barter-message-${product.id}" class="block font-medium mb-1">Offer Description</label>
    <textarea id="barter-message-${product.id}" rows="4" class="w-full border p-2 rounded mb-4" placeholder="Describe what you want to offer for exchange..."></textarea>

    <label for="barter-extra-${product.id}" class="block font-medium mb-1">💰 How much extra would you pay? (optional)</label>
    <input type="number" id="barter-extra-${product.id}" step="0.01" min="0" class="w-full border p-2 rounded mb-4" placeholder="e.g. 5.00">

    <label for="barter-file-${product.id}" class="block font-medium mb-1">📎 Attach a file (optional)</label>
    <input type="file" id="barter-file-${product.id}" class="w-full border p-2 rounded mb-4" accept="image/*,audio/*,video/*,application/pdf">

    <div class="flex justify-end space-x-2 mt-3">
      <button onclick="submitBarterRequest('${product.id}')" class="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">Submit</button>
      <button onclick="document.getElementById('barter-modal-${product.id}').style.display='none'" class="bg-gray-300 px-4 py-1 rounded hover:bg-gray-400">Cancel</button>
    </div>
  </div>
`;

item.insertAdjacentHTML('beforeend', modalHTML);
}

// 仅卖家可见：打印该商品的所有 barter 请求到控制台
if (currentUser && currentUser.uid === product.seller_uid) {
  const dbgBtn = document.createElement("button");
  dbgBtn.textContent = "🧪 Console: Barter Requests";
  dbgBtn.className = "mt-2 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800";
  dbgBtn.onclick = () => window.debugListBarterRequests(product.id);
  item.appendChild(dbgBtn);
}


// —— 卖家功能：查看并处理易货请求（按钮 + 弹窗）——
if (currentUser && currentUser.uid === product.seller_uid) {
  // 入口按钮
  const viewBtn = document.createElement("button");
  viewBtn.textContent = "🗂 View Barter Requests";
  viewBtn.className = "mt-2 ml-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700";
  viewBtn.onclick = () => window.showBarterRequests(product.id, product.name);
  item.appendChild(viewBtn);

  // 弹窗容器（每个商品一个，id 带上 productId）
  const sellerModalHTML = `
    <div id="barter-requests-modal-${product.id}"
         style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000;">
      <div style="position:absolute; top:10%; left:50%; transform:translateX(-50%);
                  width:min(900px, 92vw); background:#fff; border-radius:10px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="font-size:18px; font-weight:700;">Barter Requests – ${product.name}</h3>
          <button onclick="document.getElementById('barter-requests-modal-${product.id}').style.display='none'"
                  style="padding:4px 10px; border-radius:6px; background:#eee;">Close</button>
        </div>
        <div id="barter-requests-body-${product.id}" style="max-height:60vh; overflow:auto; border-top:1px solid #eee; padding-top:8px;">
          <p style="color:#666; font-size:14px;">Loading…</p>
        </div>
      </div>
    </div>
  `;
  item.insertAdjacentHTML('beforeend', sellerModalHTML);
}

        
startCountdown(
  `cd-${product.id}`,
  endsAt,
  product.id,
  product.current_bid || product.starting_bid || 0,
  product.current_bidder || '',
  product.bids || []
);
loadReviewsForProduct(product.seller_uid, product.id, item);

        
        if (currentUser) {
  const favBtn = document.getElementById(`fav-btn-${product.id}`);
  const favRef = doc(db, "users", currentUser.uid, "favorites", product.id);
  getDoc(favRef).then((favSnap) => {
    
    if (favSnap.exists()) {
  favBtn.setAttribute("data-fav", "true");
  favBtn.textContent = "★"; // 实星
  favBtn.style.color = "gold"; // 变黄色
} else {
  favBtn.setAttribute("data-fav", "false");
  favBtn.textContent = "☆"; // 空星
  favBtn.style.color = "black"; // 黑色
}
    
  }).catch((err) => {
    console.error("❌ Error loading favorite status:", err);
  });
}
        
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

    // 🔒 如果商品已锁定，则阻止出价
if (productData.barter_locked === true) {
  error.style.color = 'red';
  error.innerText = "🔒 This item is locked for barter. Bidding is disabled.";
  return;
}

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

   // ✅ 出价成功 → 提示绿色文字
error.style.color = 'green';
error.innerText = '✅ Bid placed successfully!';

// 清空输入框
input.value = '';

// ✅ 延时 1.5 秒后 reload
setTimeout(() => {
  location.reload();
}, 1500);

  } catch (err) {
    console.error(err);
    error.innerText = "Error placing bid.";
  }
};

window.toggleHistory = function(id) {
  const el = document.getElementById(`history-${id}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.toggleFavorite = async function(productId) {
  if (!currentUser) {
    alert("Please log in to use Favorites.");
    return;
  }

  const favBtn = document.getElementById(`fav-btn-${productId}`);
  const isFav = favBtn.getAttribute("data-fav") === "true";
  const favRef = doc(db, "users", currentUser.uid, "favorites", productId);

  try {
    
    if (isFav) {
  // 取消收藏 → 删除 doc
  await deleteDoc(favRef);
  favBtn.setAttribute("data-fav", "false");
  favBtn.textContent = "☆"; // 空星
  favBtn.style.color = "black"; // 恢复黑色
} else {
  // 添加收藏
  await setDoc(favRef, {
    added_at: new Date()
  });
  favBtn.setAttribute("data-fav", "true");
  favBtn.textContent = "★"; // 实星
  favBtn.style.color = "gold"; // 变黄色
}
    
  } catch (err) {
    console.error("❌ Error toggling favorite:", err);
  }
};


async function loadReviewsForProduct(sellerUid, productId, item) {
  if (!sellerUid || !productId) {
    console.warn("❌ Missing sellerUid or productId:", sellerUid, productId);
    return;
  }

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

    totalGood += good.length;
    totalBad += bad.length;
    totalCount += total;

    const rate = total > 0 ? Math.round((good.length / total) * 100) : 0;
    const summary = document.createElement("p");
    summary.innerHTML = `👍 Good: ${good.length} | 👎 Bad: ${bad.length} | ⭐️ Good Rate: ${rate}%`;
    summary.style.fontWeight = "bold";
    item.appendChild(summary);

  } catch (e) {
    console.warn("⚠️ Failed to load reviews:", e);
  }
}

// 🔒 Buyer submits barter request for a product (with optional extra cash + attachment)
window.submitBarterRequest = async function(productId) {
  const textarea   = document.getElementById(`barter-message-${productId}`);
  const extraInput = document.getElementById(`barter-extra-${productId}`);
  const fileInput  = document.getElementById(`barter-file-${productId}`);

  const message = (textarea?.value || '').trim();
  const extraRaw = (extraInput?.value || '').trim();
  const extra = parseFloat(extraRaw);
  const safeExtra = isNaN(extra) || extra < 0 ? 0 : extra;

  if (!currentUser) {
    alert("Please log in first.");
    return;
  }
  if (!message) {
    alert("Please describe your barter offer.");
    return;
  }

  // 防重复提交
  const modal = document.getElementById(`barter-modal-${productId}`);
  const submitBtn = modal?.querySelector(`button.bg-green-600`);
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }

  let attachment = null;

  try {
    // 1) 如果选择了文件 → 上传到 Storage
    const file = fileInput?.files?.[0];
    if (file) {
      // 简单大小限制（25MB）
      const MAX_BYTES = 25 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        throw new Error("File is too large. Please keep it under 25MB.");
      }

      const storage = getStorage(); // 默认 app
      const path = `barter_attachments/${productId}/${currentUser.uid}_${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);

      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);

      attachment = {
        url,
        path,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size
      };
    }

    // 2) 写入 Firestore（包含金额 + 可选附件）
    const payload = {
      user_email: currentUser.email,
      user_uid: currentUser.uid,
      offer_message: message,
      extra_cash_offer: safeExtra,
      submitted_at: new Date()
    };
    if (attachment) payload.attachment = attachment;

    await setDoc(doc(db, "products", productId, "barter_requests", currentUser.uid), payload);

    alert("✅ Your barter request has been submitted!");
    if (modal) modal.style.display = 'none';
    if (textarea) textarea.value = '';
    if (extraInput) extraInput.value = '';
    if (fileInput) fileInput.value = '';
  } catch (e) {
    console.error("❌ Failed to submit barter request:", e);
    alert(e?.message || "Error submitting barter request.");
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit"; }
  }
};

// 🧪 Print all barter requests of a product to Console (seller-only debug)
window.debugListBarterRequests = async function(productId) {
  try {
    const snap = await getDocs(collection(db, "products", productId, "barter_requests"));
    const rows = [];
    snap.forEach(d => rows.push({ doc_id: d.id, ...d.data() }));
    console.table(rows);
    alert(`Printed ${rows.length} barter requests to console.`);
  } catch (e) {
    console.error("❌ Failed to list barter requests:", e);
    alert("Error listing barter requests (see console).");
  }
};


// —— 卖家查看易货请求：打开弹窗并渲染列表 ——
window.showBarterRequests = async function(productId, productName) {
  const modal = document.getElementById(`barter-requests-modal-${productId}`);
  const body  = document.getElementById(`barter-requests-body-${productId}`);
  if (!modal || !body) return;

  modal.style.display = 'block';
  body.innerHTML = `<p style="color:#666; font-size:14px;">Loading…</p>`;

  try {
    const snap = await getDocs(collection(db, "products", productId, "barter_requests"));
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (!rows.length) {
      body.innerHTML = `<p style="color:#666;">No barter requests yet.</p>`;
      return;
    }

    const listHtml = rows.map(r => {
      const msg   = r.offer_message || "(no message)";
      const extra = (typeof r.extra_cash_offer === 'number') ? r.extra_cash_offer : 0;
      const when  = r.submitted_at?.toDate ? r.submitted_at.toDate().toLocaleString() : "—";
      const email = r.user_email || r.user_uid || "—";

      const att = r.attachment?.url
        ? `<div style="margin-top:4px;">
             <a href="${r.attachment.url}" target="_blank" rel="noopener"
                style="color:#2563eb; text-decoration:underline;">Attachment</a>
             <span style="color:#999; font-size:12px;"> ${r.attachment.file_name || ""}</span>
           </div>`
        : "";

      return `
        <div style="border:1px solid #eee; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="flex:1;">
              <div style="font-size:14px;"><b>From:</b> ${email}</div>
              <div style="font-size:14px; margin-top:4px;"><b>Offer:</b> ${msg}</div>
              <div style="font-size:14px; margin-top:4px;"><b>Extra cash:</b> $${extra}</div>
              <div style="font-size:12px; color:#666; margin-top:4px;">${when}</div>
              ${att}
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; min-width:120px;">
              <button onclick="window.approveBarterRequest('${productId}', '${r.id}')"
                      style="background:#16a34a; color:#fff; padding:6px 10px; border-radius:6px;">Accept</button>
              <button onclick="window.declineBarterRequest('${productId}', '${r.id}')"
                      style="background:#e11d48; color:#fff; padding:6px 10px; border-radius:6px;">Decline</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    body.innerHTML = listHtml;

  } catch (e) {
    console.error("Failed to load barter requests:", e);
    body.innerHTML = `<p style="color:#dc2626;">Failed to load requests. Please try again.</p>`;
  }
};

// —— 接受：锁定为易货，并记录选中的请求（落到产品文档上） ——
window.approveBarterRequest = async function(productId, requestId) {
  try {
    const reqRef  = doc(db, "products", productId, "barter_requests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      alert("This request no longer exists.");
      return;
    }
    const data = reqSnap.data();

    const prodRef = doc(db, "products", productId);
    await updateDoc(prodRef, {
      barter_locked: true,
      barter_selected_request: {
        request_id: requestId,
        ...data,
        decided_at: new Date(),
        decided_by: currentUser?.uid || null
      }
    });

    alert("✅ Accepted. The item is now locked for barter.");
    const modal = document.getElementById(`barter-requests-modal-${productId}`);
    if (modal) modal.style.display = 'none';
    location.reload();
  } catch (e) {
    console.error("Approve failed:", e);
    alert("Failed to accept. See console for details.");
  }
};

// —— 拒绝：默认“软拒绝”（不删文档），需要真删除就取消注释 deleteDoc ——
window.declineBarterRequest = async function(productId, requestId) {
  try {
    // 真删除：取消下一行注释
    // await deleteDoc(doc(db, "products", productId, "barter_requests", requestId));
    alert("❎ Declined (no changes to the product).");
    // 如启用删除，可刷新列表：
    // window.showBarterRequests(productId);
  } catch (e) {
    console.error("Decline failed:", e);
    alert("Failed to decline. See console for details.");
  }
};
