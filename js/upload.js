import { auth, db } from '../firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// 🌎 省市数据映射
const provinceCityMap = {
  "Ontario": ["Toronto", "Ottawa", "Mississauga"],
  "British Columbia": ["Vancouver", "Victoria", "Richmond"],
  "Alberta": ["Calgary", "Edmonton", "Red Deer"],
  "Quebec": ["Montreal", "Quebec City", "Laval"],
  "Manitoba": ["Winnipeg", "Brandon"],
  "Saskatchewan": ["Saskatoon", "Regina"],
  "Nova Scotia": ["Halifax"],
  "New Brunswick": ["Moncton", "Fredericton"],
  "Newfoundland and Labrador": ["St. John's"],
  "Prince Edward Island": ["Charlottetown"],
  "Northwest Territories": ["Yellowknife"],
  "Yukon": ["Whitehorse"],
  "Nunavut": ["Iqaluit"]
};

// DOM 元素
const form = document.getElementById("upload-form");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");

// 加载省份选项
for (const province in provinceCityMap) {
  const option = document.createElement("option");
  option.value = province;
  option.textContent = province;
  provinceSelect.appendChild(option);
}

// 监听省份变化，更新城市
provinceSelect.addEventListener("change", () => {
  const cities = provinceCityMap[provinceSelect.value] || [];
  citySelect.innerHTML = '<option value="">Select City</option>';
  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    citySelect.appendChild(option);
  });
});

// 用户状态
let currentUser = null;
let isMember = false;

// 登录与会员验证
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }
  currentUser = user;

  try {
    const docRef = doc(db, "memberships", user.uid);
    const docSnap = await getDoc(docRef);
    const paidUntil = docSnap.data()?.paid_until?.seconds * 1000;

    if (paidUntil && paidUntil > Date.now()) {
      isMember = true;
    } else {
      message.innerText = "⛔️ You must be a member to upload products.";
      form.style.display = "none";
    }
  } catch (e) {
    console.error("Failed to check membership:", e);
    message.innerText = "⚠️ Failed to verify membership.";
  }
});

// 提交处理
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.innerText = "";
  submitBtn.disabled = true;
  submitBtn.innerText = "Uploading...";

  if (!currentUser || !isMember) {
    message.innerText = "⛔️ Only logged-in members can upload.";
    return;
  }

  const name = form["name"].value.trim();
  const price = parseFloat(form["price"].value);
  const description = form["description"].value.trim();
  const imageUrl = form["image_url"].value.trim();
  const endsAtRaw = form["ends_at"].value;

  if (!name || isNaN(price) || !description || !imageUrl || !endsAtRaw) {
    message.innerText = "❌ Please fill in all fields correctly.";
    return;
  }

  const endsAt = new Date(endsAtRaw);

  // ✅ 交付信息
  const shippingEnabled = form["shipping_enabled"].checked;
  const pickupEnabled = form["pickup_enabled"].checked;
  const shippingFee = shippingEnabled ? parseFloat(form["shipping_fee"].value) || 0 : 0;
  const pickupAddress = pickupEnabled ? form["pickup_address"].value.trim() : "";

  if (shippingEnabled && isNaN(parseFloat(form["shipping_fee"].value))) {
    message.innerText = "❌ Please enter a valid shipping fee.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  if (pickupEnabled && !pickupAddress) {
    message.innerText = "❌ Please enter a pickup location.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  // ✅ 地址字段
  const country = form["country"].value;
  const province = form["province"].value;
  const city = form["city"].value;

  if (!country || !province || !city) {
  message.innerText = "❌ Please select your shipping address (country, province, city).";
  submitBtn.disabled = false;
  submitBtn.innerText = "✅ Upload Product";
  return;
}

  try {
    await addDoc(collection(db, "products"), {
      name,
      price,
      description,
      image_url: imageUrl,
      uploader_uid: currentUser.uid,
      seller_name: currentUser.email || "Anonymous",
      starting_bid: price,
      bids: [],
      current_bid: price,
      ends_at: endsAt,
      shipping_enabled: shippingEnabled,
      shipping_fee: shippingFee,
      pickup_enabled: pickupEnabled,
      pickup_address: pickupAddress,
      shipping_address: { country, province, city },
      created_at: serverTimestamp()
    });

    form.reset();
    message.style.color = "green";
    message.innerText = "✅ Product uploaded successfully!";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
  } catch (err) {
    console.error("Upload failed:", err);
    message.style.color = "red";
    message.innerText = "❌ Upload failed. Try again.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
  }
});

// 💡 显示隐藏切换
const shippingCheckbox = document.getElementById("shipping_enabled");
const pickupCheckbox = document.getElementById("pickup_enabled");
const shippingFeeGroup = document.getElementById("shipping-fee-group");
const pickupAddressGroup = document.getElementById("pickup-address-group");

shippingCheckbox.addEventListener("change", () => {
  shippingFeeGroup.classList.toggle("hidden", !shippingCheckbox.checked);
});

pickupCheckbox.addEventListener("change", () => {
  pickupAddressGroup.classList.toggle("hidden", !pickupCheckbox.checked);
});
