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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  // ✅ 移到这里：读取用户省份来设置税率
  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const province = userSnap.data().province;
      if (province && PROVINCE_TAX_RATES.hasOwnProperty(province)) {
        taxRate = PROVINCE_TAX_RATES[province];
      }
    }
  } catch (e) {
    console.warn("⚠️ Failed to load user's province:", e);
  }

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
  // ⭐️ 如果是 pickup 且状态为 paid/shipped/completed，显示 Pickup Code 警告
// ⭐️ 如果是 paid/shipped/completed
if (["paid", "shipped", "completed"].includes(order.order_status)) {
  // 显示 buyer_note（如果有）
  const buyerNote = order.payment_info?.buyer_note || "";
  if (buyerNote) {
    const noteP = document.createElement("p");
    noteP.innerHTML = `<strong>Buyer Note:</strong> ${buyerNote}`;
    card.appendChild(noteP);
  }

  // 如果是 pickup，显示提取码
  if (
    order.payment_info?.delivery_method === "pickup" &&
    order.payment_info?.pickup_code
  ) {
    const codeP = document.createElement("p");
    codeP.innerHTML = `<strong>Pickup Code:</strong> <span style="font-size: 1.1em; font-weight: bold;">${order.payment_info.pickup_code}</span>`;
    card.appendChild(codeP);

    const warnP = document.createElement("p");
    warnP.style.color = "darkred";
    warnP.style.fontSize = "0.9em";
    warnP.innerText = "⚠️ Do NOT share this code until you have received the item!";
    card.appendChild(warnP);
  }
}


    // 若待付款，显示 Pay Now 按钮
    if (order.order_status === "pending_payment") {
     const payBtn = document.createElement("button");
payBtn.className = "pay-btn";
payBtn.innerText = "Pay Now";
payBtn.addEventListener("click", () => {
  const baseAmount = order.winning_bid_amount || 0;
  let deliveryMethod = "shipping";
  let shippingFee = order.shipping_enabled ? (order.shipping_fee || 0) : 0;

  // 创建模态框
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.innerHTML = `
    <div style="background:white; padding:20px; border-radius:8px; width:300px; text-align:left;">
      <h3>Choose Delivery Option</h3>
      ${order.shipping_enabled ? `<label><input type="radio" name="method" value="shipping" checked> Shipping ($${shippingFee.toFixed(2)})</label><br>` : ""}
      ${order.pickup_enabled ? `<label><input type="radio" name="method" value="pickup"> Pickup at ${order.pickup_address?.city || "?"}, ${order.pickup_address?.province || "?"}, ${order.pickup_address?.country || "?"}</label><br>` : ""}
      <br>
      <button id="confirm-delivery">Confirm</button>
      <button id="cancel-delivery" style="margin-left:10px;">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancel-delivery").onclick = () => modal.remove();

  document.getElementById("confirm-delivery").onclick = () => {
    const selected = modal.querySelector("input[name='method']:checked")?.value || "shipping";
    deliveryMethod = selected;
    shippingFee = (selected === "shipping") ? (order.shipping_fee || 0) : 0;
    modal.remove();

    let fee = Math.round(baseAmount * 0.10 * 100) / 100 + 0.5;
    if (fee < 1) fee = 1;

    const subtotal = baseAmount + fee + shippingFee;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalToPay = Math.round((subtotal + taxAmount) * 100) / 100;

    const confirmPay = confirm(
      `Winning Bid: $${baseAmount.toFixed(2)}\n` +
      `Platform Fee: $${fee.toFixed(2)}\n` +
      `Shipping Fee: $${shippingFee.toFixed(2)}\n` +
      `Tax (${(taxRate * 100).toFixed(2)}%): $${taxAmount.toFixed(2)}\n` +
      `Total to Pay: $${totalToPay.toFixed(2)}\n\n` +
      `Do you want to proceed to pay?`
    );

    if (confirmPay) {
      window.location.href = `/payment.html?product_id=${order.id}&total_amount=${totalToPay}&method=${deliveryMethod}`;
    }
  };
});

      card.appendChild(payBtn); // ✅ 这里放 if 里面最后一行
    }

 // ✅ 插入评论按钮：如果订单状态是 shipped 或 completed，显示 Review Seller 按钮
    if (["shipped", "completed"].includes(order.order_status)) {
      const reviewBtn = document.createElement("button");
      reviewBtn.innerText = "📝 Review Seller";
      reviewBtn.className = "pay-btn";
      reviewBtn.style.backgroundColor = "#007BFF";
  reviewBtn.onclick = () => {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
modal.innerHTML = `
  <div style="background:white; padding:20px; border-radius:8px; width:300px; text-align:left;">
    <h3>Rate Seller</h3>
    <label><input type="radio" name="rating" value="good" checked> 👍 Good</label><br>
    <label><input type="radio" name="rating" value="bad"> 👎 Bad</label><br><br>
    <label for="review-text">Review (optional):</label><br>
    <textarea id="review-text" rows="4" placeholder="Write your review..." style="width:100%;"></textarea><br><br>
    <button id="submit-review">Submit</button>
    <button id="cancel-review" style="margin-left:10px;">Cancel</button>
  </div>
`;

  document.body.appendChild(modal);

  document.getElementById("cancel-review").onclick = () => modal.remove();

  document.getElementById("submit-review").onclick = async () => {
    const rating = modal.querySelector("input[name='rating']:checked")?.value;
    const text = document.getElementById("review-text").value.trim();


    modal.remove();

    try {
      const reviewRef = doc(db, "reviews", `${order.id}_${auth.currentUser.uid}`);
      await setDoc(reviewRef, {
        product_id: order.id,
        seller_uid: order.uploader_uid,
        buyer_uid: auth.currentUser.uid,
        buyer_email: auth.currentUser.email,
        rating: rating,
        review_text: text,
        created_at: new Date()
      });
      alert("✅ Review submitted!");
    } catch (err) {
      console.error("❌ Failed to submit review:", err);
      alert("❌ Failed to submit review.");
    }
  };
};

      card.appendChild(reviewBtn);
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
