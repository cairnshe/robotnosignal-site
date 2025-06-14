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
     <p><strong>Order Status:</strong> ${getOrderStatusLabel(order.order_status)}</p>
    `;

    // ✅ 如果是已发货，显示物流单号与发货时间
if (order.order_status === "shipped") {
  const trackingNumber = order.payment_info?.tracking_number || "(not available)";
  const shippedAtRaw = order.shipped_at;
  const shippedAtFormatted = shippedAtRaw
    ? new Date(shippedAtRaw).toLocaleString()
    : "(unknown time)";

  const trackingP = document.createElement("p");
  trackingP.innerHTML = `<strong>Tracking Number:</strong> ${trackingNumber}`;
  card.appendChild(trackingP);

  const timeP = document.createElement("p");
  timeP.innerHTML = `<strong>Shipped At:</strong> ${shippedAtFormatted}`;
  card.appendChild(timeP);
}


    // ⭐️ 新增 → 如果是 paid/shipped/completed → 显示 buyer_note（如果有）
    if (["paid", "shipped", "completed"].includes(order.order_status)) {
      const buyerNote = order.payment_info?.buyer_note || "";
      if (buyerNote) {
        const noteP = document.createElement("p");
        noteP.innerHTML = `<strong>Buyer Note:</strong> ${buyerNote}`;
        card.appendChild(noteP);
      }
    }

    // 若待付款，显示 Pay Now 按钮
    if (order.order_status === "pending_payment") {
      const payBtn = document.createElement("button");
      payBtn.className = "pay-btn";
      payBtn.innerText = "Pay Now";
      payBtn.addEventListener("click", () => {
        const baseAmount = order.winning_bid_amount || 0;
        let fee = Math.round(baseAmount * 0.10 * 100) / 100 + 0.5;
        if (fee < 1) fee = 1;

        const totalToPay = Math.round((baseAmount + fee) * 100) / 100;

        const confirmPay = confirm(
          `Winning Bid: $${baseAmount}\n` +
          `Platform Fee: $${fee.toFixed(2)}\n` +
          `Total to Pay: $${totalToPay.toFixed(2)}\n\n` +
          `Do you want to proceed to pay?`
        );

        if (confirmPay) {
          window.location.href = `/payment.html?product_id=${order.id}&total_amount=${totalToPay}`;
        }
      });
      card.appendChild(payBtn); // ✅ 这里放 if 里面最后一行
    }

    container.appendChild(card); // ✅ 每张 card 最后 append 到 container
  });
}

function getOrderStatusLabel(status) {
  switch (status) {
    case "pending_payment":
      return "Pending Payment - Please proceed to payment.";
    case "paid":
      return "Paid - Waiting for seller to ship.";
    case "shipped":
      return "Shipped - Waiting for your confirmation.";
    case "completed":
      return "Completed - Thank you for your support!";
    default:
      return status; // fallback
  }
}
