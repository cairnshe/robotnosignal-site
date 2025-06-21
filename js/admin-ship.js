// admin-ship.js

import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ✅ 加入 emailjs
import emailjs from 'https://cdn.jsdelivr.net/npm/emailjs-com@3.2.0/dist/email.min.js';

// EmailJS config
const EMAILJS_SERVICE_ID = 'service_45v1ooq';
const EMAILJS_TEMPLATE_ID = 'template_qm0xhch';
const EMAILJS_PUBLIC_KEY = 'ibgUPxywW3fHZGgSq';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  if (user.uid !== "MT9pIgLkiadS3WbsLeui8zR3umd2") {
    document.body.innerHTML = "<h1>Access Denied</h1>";
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });

    // ✅ 发货统计
const readyToShipCount = products.filter(p => p.order_status === "paid").length;
const shippedCount = products.filter(p => p.order_status === "shipped").length;

const statsContainer = document.getElementById("order-stats");
statsContainer.innerHTML = `
  📊 <strong>Orders Overview:</strong><br>
  🟢 Ready to ship: ${readyToShipCount}<br>
  ✅ Already shipped: ${shippedCount}
`;

    const paidOrders = products.filter(p => p.order_status === "paid");

    renderPaidOrders(paidOrders);

  } catch (err) {
    console.error("Failed to load orders:", err);
  }
});

function renderPaidOrders(orders) {
  const container = document.getElementById("orders-list");
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
      <p><strong>Buyer:</strong> ${order.winning_bidder}</p>

 <p><strong>Delivery Method:</strong> ${order.payment_info?.delivery_method === "pickup" ? "Pickup" : "Shipping"}</p>

${
  order.payment_info?.delivery_method === "pickup"
    ? `
      <p><strong>Pickup Location:</strong> ${order.pickup_address?.city || 'Unknown'}, ${order.pickup_address?.province || 'Unknown'}, ${order.pickup_address?.country || 'Unknown'}</p>
      <p><strong>Pickup Code:</strong> <span style="font-weight:bold;">${order.payment_info?.pickup_code || '(missing)'}</span></p>
      <p style="color:darkred; font-size:0.9em;">⚠️ Remind buyer: Do NOT share this code until they have received the item.</p>
    `
    : `<p><strong>Shipping Fee:</strong> $${(order.shipping_fee || 0).toFixed(2)}</p>`
}

      
      <label>Tracking Number:</label>
      <input type="text" id="tracking-${order.id}" placeholder="Enter tracking number" />
      <button class="ship-btn" onclick="markAsShipped('${order.id}', '${order.name}', '${order.winning_bidder}', '${order.image_url}')">Mark as Shipped & Send Email</button>
    `;

    container.appendChild(card);
  });
}

window.markAsShipped = async function (productId, productName, buyerEmail, imageUrl) {
  const trackingInput = document.getElementById(`tracking-${productId}`);
  const trackingNumber = trackingInput.value.trim();

  if (!trackingNumber) {
    alert("Please enter a tracking number.");
    return;
  }

  // Update Firestore
  const productRef = doc(db, "products", productId);
 await updateDoc(productRef, {
  order_status: "shipped",
  "payment_info.tracking_number": trackingNumber,
  shipped_at: new Date().toISOString()  // ⏱ 加入发货时间
});


  // Send Email via EmailJS
  try {
// 先获取该商品信息
const productSnap = await getDoc(doc(db, "products", productId));
const productData = productSnap.exists() ? productSnap.data() : {};
const deliveryMethod = productData.payment_info?.delivery_method || "shipping";

const isPickup = deliveryMethod === "pickup";
const pickupCode = productData.payment_info?.pickup_code || "";
const pickupAddr = productData.pickup_address
  ? `${productData.pickup_address.city || ''}, ${productData.pickup_address.province || ''}, ${productData.pickup_address.country || ''}`
  : "";

const params = {
  product_name: productName,
  tracking_number: trackingNumber,
  to_email: buyerEmail,
  image_url: imageUrl,
  pickup_info: isPickup
    ? `This is a PICKUP order.\nPickup Code: ${pickupCode}\nPickup Location: ${pickupAddr}\n\n⚠️ Please DO NOT share your pickup code until you have received your item.`
    : ""
};


    console.log("🚀 Sending Email via EmailJS with params:", params);

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      params,
      EMAILJS_PUBLIC_KEY
    );

    console.log("✅ Email sent successfully:", response);
    alert("Order marked as shipped and email sent!");

    // Refresh page
    location.reload();

  } catch (error) {
    console.error('❌ Failed to send email:', error);
    alert(
      "Order marked as shipped, but failed to send email.\n\nError details:\n" + 
      JSON.stringify(error)
    );
  }
};

