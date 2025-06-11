import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 获取 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('product_id');
const totalAmount = parseFloat(urlParams.get('total_amount') || "0");

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
      <button id="pay-now-btn" class="pay-btn">Confirm Payment</button>
    `;

    // 点击 Confirm Payment 按钮
    document.getElementById("pay-now-btn").addEventListener("click", async () => {
      try {
        await updateDoc(productRef, {
          order_status: "paid",
          payment_info: {
            paid_at: new Date(),
            paid_amount: totalAmount, // ⭐️ 保存总金额
            method: "manual_test" // 你以后可以改成真实支付方式
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
