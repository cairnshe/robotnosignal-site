// admin-ship.js

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

// EmailJS config
const EMAILJS_SERVICE_ID = 'service_45v1ooq';
const EMAILJS_TEMPLATE_ID = 'template_qm0xhch';
const EMAILJS_PUBLIC_KEY = 'ibgUPxywW3fHZGgSq'; // ⚠️ 填你自己的 public key

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
      <label>Tracking Number:</label>
      <input type="text" id="tracking-${order.id}" placeholder="Enter tracking number" />
      <button class="ship-btn" onclick="markAsShipped('${order.id}', '${order.name}', '${order.winning_bidder}')">Mark as Shipped & Send Email</button>
    `;

    container.appendChild(card);
  });
}

window.markAsShipped = async function (productId, productName, buyerEmail) {
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
    "payment_info.tracking_number": trackingNumber
  });

  // Send Email via EmailJS
  try {
    const params = {
      product_name: productName,
      tracking_number: trackingNumber,
      to_email: buyerEmail
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

