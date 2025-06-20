import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// 生成 6 位提取码（避免易混字符）
function generatePickupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符 like I, O, 1, 0
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 初始化 Storage
const storage = getStorage();


// 获取 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('product_id');
const totalAmount = parseFloat(urlParams.get('total_amount') || "0");
const deliveryMethod = urlParams.get('method'); // "shipping" or "pickup"

if (!productId) {
  document.getElementById("payment-card").innerHTML = "<p>Invalid product ID.</p>";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const productRef = doc(db, "products", productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      document.getElementById("payment-card").innerHTML = "<p>Product not found.</p>";
      return;
    }

    const product = productSnap.data();

    // 检查是否本人
    if (product.winning_bidder !== user.email) {
      document.getElementById("payment-card").innerHTML = "<p>You are not the winning bidder for this product.</p>";
      return;
    }

    // 检查状态
    if (product.order_status !== "pending_payment") {
      document.getElementById("payment-card").innerHTML = "<p>This order is not pending payment.</p>";
      return;
    }

    // 渲染支付卡片
    document.getElementById("payment-card").innerHTML = `
  <h2>${product.name}</h2>
  <img src="${product.image_url}" alt="${product.name}" />
  <p><strong>Winning Bid:</strong> $${product.winning_bid_amount}</p>
  <p><strong>Order Status:</strong> ${product.order_status}</p>
  <p><strong>Total To Pay:</strong> $${totalAmount.toFixed(2)}</p>

${deliveryMethod === "pickup" ? `
  <p><strong>Delivery Method:</strong> Pickup</p>
  <p><strong>Pickup Location:</strong> ${product.pickup_address?.city || 'Unknown'}, ${product.pickup_address?.province || 'Unknown'}, ${product.pickup_address?.country || 'Unknown'}</p>
  <p><strong>Pickup Code:</strong> (will be shown after payment)</p>
` : `
  <p><strong>Delivery Method:</strong> Shipping</p>
  <p><strong>Shipping Fee:</strong> $${(product.shipping_fee || 0).toFixed(2)}</p>
`}

 <p><strong>Upload Payment Receipt (Optional, Not Enabled Yet):</strong></p>
<input type="file" id="receipt-file" accept="image/*" disabled style="opacity: 0.5;" />
<p style="font-size: 0.9em; color: gray;">(Image upload not enabled yet. Please fill in your payment note below.)</p>

<p><strong>Payment Note:</strong> (e.g., "Paid via WeChat on 6/11, last 4 digits of sender phone 1234")</p>
<textarea id="payment-note" rows="3" style="width:100%;" placeholder="Enter your payment note here..."></textarea>

<br /><br />
<button id="pay-now-btn" class="pay-btn">Confirm Payment</button>
`;


    // 点击 Confirm Payment 按钮
 document.getElementById("pay-now-btn").addEventListener("click", async () => {
  const noteInput = document.getElementById("payment-note");
  const buyerNote = noteInput.value.trim();

  if (!buyerNote) {
    alert("❗ Please enter your payment note.");
    return;
  }

  try {
    const pickupCode = deliveryMethod === "pickup" ? generatePickupCode() : null;
    // 更新 Firestore
    await updateDoc(productRef, {
      order_status: "paid",
      payment_info: {
      paid_at: new Date(),
      paid_amount: totalAmount,
      method: "manual_test",
      receipt_url: "", // 未来有 Storage 再用
      buyer_note: buyerNote,
      delivery_method: deliveryMethod // ⭐️ 存配送方式
    }
    });

    alert("✅ Payment successful!");
    window.location.href = "/my-orders.html";
  } catch (err) {
    console.error("Payment failed:", err);
    alert("❌ Payment failed.");
  }
});


  } catch (err) {
    console.error("Failed to load product:", err);
    document.getElementById("payment-card").innerHTML = "<p>Failed to load product.</p>";
  }
});
