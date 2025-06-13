import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// EmailJS 配置
import emailjs from 'https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js';
emailjs.init("YOUR_EMAILJS_USER_ID"); // ⭐️ 你去 EmailJS 拿 USER_ID 放这里

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

    // 只保留自己上传的 & 已付款订单
    const myOrders = products.filter(p =>
      p.uploader_uid === user.uid &&
      p.order_status === "paid"
    );

    renderOrdersToShip(myOrders);

  } catch (err) {
    console.error("Failed to load seller orders:", err);
  }
});

function renderOrdersToShip(orders) {
  const container = document.getElementById("orders-to-ship-list");
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = "<p>No paid orders to ship.</p>";
    return;
  }

  orders.forEach(order => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <h3>${order.name}</h3>
      <img src="${order.image_url}" alt="${order.name}" />
      <p><strong>Winning Bid:</strong> $${order.winning_bid_amount}</p>
      <p><strong>Buyer Email:</strong> ${order.winning_bidder}</p>
      <p><strong>Buyer Note:</strong> ${order.payment_info?.buyer_note || "(none)"}</p>
      <p><strong>Order Status:</strong> Paid</p>

      <label><strong>Tracking Number:</strong></label><br/>
      <input type="text" id="tracking-${order.id}" placeholder="Enter tracking number" style="width:100%;margin-bottom:0.5rem;"/><br/>
      
      <button class="ship-btn">Mark as Shipped</button>
    `;

    const shipBtn = card.querySelector(".ship-btn");
    shipBtn.addEventListener("click", async () => {
      const trackingInput = document.getElementById(`tracking-${order.id}`);
      const trackingNumber = trackingInput.value.trim();

      if (!trackingNumber) {
        alert("Please enter the tracking number.");
        return;
      }

      try {
        // 更新 Firestore
        const orderRef = doc(db, "products", order.id);
        await updateDoc(orderRef, {
          order_status: "shipped",
          shipping_info: {
            tracking_number: trackingNumber,
            shipped_at: new Date()
          }
        });

        // 发送邮件
        await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
          to_email: order.winning_bidder,
          product_name: order.name,
          tracking_number: trackingNumber
        });

        alert("✅ Order marked as shipped and buyer notified.");
        window.location.reload(); // 刷新页面

      } catch (err) {
        console.error("Failed to mark as shipped:", err);
        alert("❌ Failed to mark as shipped.");
      }
    });

    container.appendChild(card);
  });
}
