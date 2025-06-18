import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 加拿大各省税率映射表（仅支持主要省份）
const PROVINCE_TAX_RATES = {
  ON: 0.13, BC: 0.12, QC: 0.14975, AB: 0.05,
  MB: 0.12, SK: 0.11, NS: 0.15, NB: 0.15,
  PE: 0.15, NL: 0.15
};

// 默认税率（如果用户没有填写省份，就用安大略省）
let taxRate = 0.13;

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ⬇️ 新增：读取用户的省份字段设置税率
const userDocRef = doc(db, "users", user.uid);
const userSnap = await getDoc(userDocRef);
if (userSnap.exists()) {
  const province = userSnap.data().province;
  if (province && PROVINCE_TAX_RATES.hasOwnProperty(province)) {
    taxRate = PROVINCE_TAX_RATES[province];
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // ✅ 把省份税率逻辑搬到这里来
  const userDocRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    const province = userSnap.data().province;
    if (province && PROVINCE_TAX_RATES.hasOwnProperty(province)) {
      taxRate = PROVINCE_TAX_RATES[province];
    }
  }

  // 🔽 原本查询 Firestore 的逻辑保留在这里
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });

    const myOrders = products.filter(p => p.winning_bidder === user.email);

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

  // 计算平台手续费
  let fee = Math.round(baseAmount * 0.10 * 100) / 100 + 0.5;
  if (fee < 1) fee = 1;

  // 计算税（仅对 baseAmount + fee 计算）
  const subtotal = baseAmount + fee;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;

  // 总金额
  const totalToPay = Math.round((subtotal + taxAmount) * 100) / 100;

  const confirmPay = confirm(
    `Winning Bid: $${baseAmount.toFixed(2)}\n` +
    `Platform Fee: $${fee.toFixed(2)}\n` +
    `Tax (${(taxRate * 100).toFixed(2)}%): $${taxAmount.toFixed(2)}\n` +
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
