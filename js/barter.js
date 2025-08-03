import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, addDoc, collection, Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// ✅ 你可以改成引入 firebase-config.js，如果你已经创建过
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

// 获取 URL 中的 product_id 参数
const productId = new URLSearchParams(window.location.search).get("product_id");
const productContainer = document.getElementById("product-info");
const form = document.getElementById("barter-form");

let currentUser = null;
let productDoc = null;

// 监听登录状态 + 获取商品信息
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in to propose a barter.");
    window.location.href = "/login.html";
    return;
  }

  currentUser = user;

  const docRef = doc(db, "products", productId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    productContainer.innerHTML = "<p>Product not found.</p>";
    return;
  }

  productDoc = docSnap.data();
  productContainer.innerHTML = `
    <h2 class="text-xl font-bold mb-2">${productDoc.name}</h2>
    <img src="${productDoc.image_url}" class="w-48 mb-2 rounded" />
    <p>${productDoc.description}</p>
  `;
});

// 提交换物提议
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const offerItem = document.getElementById("offer-item").value.trim();
  const offerMessage = document.getElementById("offer-message").value.trim();
  const offerImage = document.getElementById("offer-image").value.trim();
  const offerValue = parseFloat(document.getElementById("offer-value").value.trim());

  if (!offerItem || !offerMessage) {
    alert("Please fill in required fields.");
    return;
  }

  try {
    await addDoc(collection(db, "barter_offers"), {
      product_id: productId,
      offered_by_uid: currentUser.uid,
      offered_by_email: currentUser.email,
      seller_uid: productDoc.uploader_uid,
      offer_item_name: offerItem,
      offer_message: offerMessage,
      offer_image_url: offerImage || "",
      offer_item_value_estimate: isNaN(offerValue) ? null : offerValue,
      status: "pending",
      timestamp: Timestamp.now()
    });

    alert("Barter offer submitted!");
    form.reset();
  } catch (err) {
    console.error("Error submitting barter:", err);
    alert("Something went wrong. Try again.");
  }
});
