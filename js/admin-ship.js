import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection, getDocs, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// EmailJS 配置
const emailjs_service_id = 'service_45v1ooq';
const emailjs_template_id = 'template_qm0xhch';
const emailjs_public_key = 'YOUR_PUBLIC_KEY'; // ⚠️ 填入你的 EmailJS public key

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

    // 只拉取已支付，待发货订单
    const paidOrders = products.filter(p => p.order_status === "paid");

    renderOrders(paidOrders);
  } catch (err) {
    console.error("Failed to load orders:", err);
  }
});

function renderOrders(orders) {
  const container = document.getElementById("orders-list");
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = "<p>No orders to ship.</p>";
    return;
  }

  orders.forEach(order => {
    const card = document.createElement("div");
    card.style.border = "1px solid #ccc";
    card.style.margin = "10px";
    card.style.padding = "10px";

    card.innerHTML = `
      <h3>${order.name}</h3>
      <img src="${order.image_url}" alt="${order.name}" width="150" />
      <p><strong>Winning Bid:</strong> $${order.winning_bid_amount}</p>
      <p><strong>Buyer:</strong> ${order.winning_bidder}</p>
      <p><strong>Current Status:</strong> ${order.order_status}</p>
      <input type="text" placeholder="Enter Tracking Number" id="tracking-${order.id}" />
      <button id="ship-${order.id}">Ship & Notify</button>
    `;

    card.querySelector(`#ship-${order.id}`).addEventListener("click", async () => {
      const trackingNumber = document.getElementById(`tracking-${order.id}`).value.trim();
      if (!trackingNumber) {
        alert("Please enter tracking number.");
        return;
      }

      try {
        // 1️⃣ 更新 Firestore
        const orderRef = doc(db, "products", order.id);
        await updateDoc(orderRef, {
          order_status: "shipped",
          tracking_number: trackingNumber
        });

        // 2️⃣ 调用 EmailJS 发邮件
        await sendShippingEmail(order, trackingNumber);

        alert("Order marked as shipped and email sent.");
        window.location.reload();

      } catch (err) {
        console.error("Failed to ship order:", err);
        alert("Failed to ship order. See console for details.");
      }
    });

    container.appendChild(card);
  });
}

async function sendShippingEmail(order, trackingNumber) {
  return emailjs.send(emailjs_service_id, emailjs_template_id, {
    product_name: order.name,
    tracking_number: trackingNumber,
    to_email: order.winning_bidder // 收件人
  }, emailjs_public_key);
}
