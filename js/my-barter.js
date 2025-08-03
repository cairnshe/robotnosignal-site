import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ✅ 或者替换为 firebase-config.js 导入路径
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

const barterList = document.getElementById("my-barter-list");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return;
  }

  const q = query(
    collection(db, "barter_offers"),
    where("offered_by_uid", "==", user.uid)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    barterList.innerHTML = "<p>You haven't submitted any barter offers yet.</p>";
    return;
  }

  for (const docSnap of querySnapshot.docs) {
    const offer = docSnap.data();
    const productRef = collection(db, "products");
    const productSnapshot = await getDocs(productRef);
    const product = productSnapshot.docs.find(p => p.id === offer.product_id)?.data();

    const wrapper = document.createElement("div");
    wrapper.className = "border p-4 rounded bg-gray-50";

    wrapper.innerHTML = `
      <h2 class="font-bold text-lg mb-2">Offer made for: ${product?.name || "Unknown Product"}</h2>
      <div class="flex gap-4">
        <img src="${product?.image_url || ''}" class="w-32 rounded border" />
        <div class="flex-1 space-y-1 text-sm">
          <p><strong>Your Item:</strong> ${offer.offer_item_name}</p>
          <p><strong>Message:</strong> ${offer.offer_message}</p>
          ${offer.offer_image_url ? `<img src="${offer.offer_image_url}" class="w-24 mt-1 rounded border" />` : ""}
          ${offer.offer_item_value_estimate ? `<p><strong>Estimated Value:</strong> $${offer.offer_item_value_estimate}</p>` : ""}
          <p><strong>Status:</strong> 
            <span class="font-semibold ${
              offer.status === "accepted" ? "text-green-600" : 
              offer.status === "rejected" ? "text-red-600" : 
              "text-gray-600"
            }">${offer.status.toUpperCase()}</span>
          </p>
        </div>
      </div>
    `;

    barterList.appendChild(wrapper);
  }
});
