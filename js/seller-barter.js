import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ✅ 或者改成引入 firebase-config.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "robot-no-signal.firebaseapp.com",
  projectId: "robot-no-signal",
  storageBucket: "robot-no-signal.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const barterList = document.getElementById("barter-list");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return;
  }

  const q = query(
    collection(db, "barter_offers"),
    where("seller_uid", "==", user.uid)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    barterList.innerHTML = "<p>No barter offers received yet.</p>";
    return;
  }

  for (const docSnap of querySnapshot.docs) {
    const offer = docSnap.data();
    const docId = docSnap.id;

    const productRef = doc(db, "products", offer.product_id);
    const productSnap = await getDocs(query(collection(db, "products")));
    const product = productSnap.docs.find(p => p.id === offer.product_id)?.data();

    const wrapper = document.createElement("div");
    wrapper.className = "border p-4 rounded bg-gray-50";

    wrapper.innerHTML = `
      <h2 class="font-bold text-lg mb-2">Offer for: ${product?.name || "Unknown Product"}</h2>
      <div class="flex gap-4">
        <img src="${product?.image_url || ''}" class="w-32 rounded border" />
        <div class="flex-1 space-y-1 text-sm">
          <p><strong>From:</strong> ${offer.offered_by_email}</p>
          <p><strong>Item:</strong> ${offer.offer_item_name}</p>
          <p><strong>Description:</strong> ${offer.offer_message}</p>
          ${offer.offer_image_url ? `<img src="${offer.offer_image_url}" class="w-24 mt-1 rounded border" />` : ""}
          ${offer.offer_item_value_estimate ? `<p><strong>Estimated Value:</strong> $${offer.offer_item_value_estimate}</p>` : ""}
          <p><strong>Status:</strong> <span id="status-${docId}" class="font-medium">${offer.status}</span></p>
        </div>
      </div>
      ${offer.status === "pending" ? `
        <div class="mt-3 space-x-2">
          <button class="accept-btn bg-green-600 text-white px-3 py-1 rounded" data-id="${docId}">Accept</button>
          <button class="reject-btn bg-red-600 text-white px-3 py-1 rounded" data-id="${docId}">Reject</button>
        </div>
      ` : ""}
    `;

    barterList.appendChild(wrapper);
  }

  // 按钮监听
  document.querySelectorAll(".accept-btn").forEach(btn => {
    btn.addEventListener("click", () => updateStatus(btn.dataset.id, "accepted"));
  });
  document.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", () => updateStatus(btn.dataset.id, "rejected"));
  });
});

async function updateStatus(docId, newStatus) {
  try {
    const docRef = doc(db, "barter_offers", docId);
    await updateDoc(docRef, { status: newStatus });
    document.getElementById(`status-${docId}`).innerText = newStatus;
    alert(`Offer ${newStatus}`);
    location.reload();
  } catch (err) {
    console.error("Error updating status:", err);
    alert("Failed to update offer.");
  }
}
