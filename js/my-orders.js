import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });

    // 只保留自己赢得的订单
    const myOrders = products.filter(p => p.winning_bidder === user.email);

    // 分组渲染
    renderOrders(myOrders, "pending_payment", "orders-to-pay-list");
    renderOrders(myOrders, "paid", "orders-paid-list");
    renderOrders(myOrders, "shipped", "orders-shipped-list");
    renderOrders(myOrders, "completed", "orders-completed-list");

  } catch (err) {
    console.error("Failed to load orders:", err);
  }
});

function renderOrders(orders, status, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const filtered = orders.filter(o => o.order_status === status);
  if (filtered.length === 0) {
    container.innerHTML = "<p>No orders.</p>";
    return;
  }

  filtered.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <h3>${order.name}</h3>
      <img src="${order.image_url}" alt="${order.name}" />
      <p><strong>Winning Bid:</strong> $${order.winning_bid_amount}</p>
      <p><strong>Order Status:</strong> ${order.order_status}</p>
    `;

    // 若待付款，显示 Pay Now 按钮（这里只是示例按钮）
   if (order.order_status === "pending_payment") {
  const payBtn = document.createElement("button");
  payBtn.className = "pay-btn";
  payBtn.innerText = "Pay Now";

  payBtn.addEventListener("click", () => {
    // 计算手续费
    const baseAmount = order.winning_bid_amount || 0;
    let fee = Math.round(baseAmount * 0.10 * 100) / 100 + 0.5;
    if (fee < 1) fee = 1;

    const totalToPay = Math.round((baseAmount + fee) * 100) / 100;

    // 弹窗确认
    const confirmPay = confirm(
      `Winning Bid: $${baseAmount}\n` +
      `Platform Fee: $${fee.toFixed(2)}\n` +
      `Total to Pay: $${totalToPay.toFixed(2)}\n\n` +
      `Do you want to proceed to pay?`
    );

    if (confirmPay) {
      // 跳转到 payment.html 并带参数
      window.location.href = `/payment.html?product_id=${order.id}&total_amount=${totalToPay}`;
    }
  });

  card.appendChild(payBtn);
}

    container.appendChild(card);
  });
}
