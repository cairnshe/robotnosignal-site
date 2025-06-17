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

// ✅ 完整省市映射
const provinceCityMap = {
  "Alberta": ["Airdrie", "Calgary", "Edmonton", "Fort McMurray", "Grande Prairie", "Leduc", "Lethbridge", "Medicine Hat", "Red Deer", "Spruce Grove", "St. Albert"],
  "British Columbia": ["Abbotsford", "Burnaby", "Chilliwack", "Coquitlam", "Kamloops", "Kelowna", "Langley", "Maple Ridge", "Nanaimo", "New Westminster", "Penticton", "Prince George", "Richmond", "Surrey", "Vancouver", "Victoria", "Vernon"],
  "Manitoba": ["Brandon", "Portage la Prairie", "Steinbach", "Thompson", "Winnipeg"],
  "New Brunswick": ["Bathurst", "Dieppe", "Fredericton", "Miramichi", "Moncton", "Saint John"],
  "Newfoundland and Labrador": ["Corner Brook", "Gander", "Happy Valley‑Goose Bay", "Mount Pearl", "St. John's"],
  "Northwest Territories": ["Fort Smith", "Hay River", "Inuvik", "Yellowknife"],
  "Nova Scotia": ["Halifax", "Kentville", "New Glasgow", "Sydney", "Truro"],
  "Nunavut": ["Iqaluit", "Rankin Inlet"],
  "Ontario": ["Ajax", "Aurora", "Barrie", "Brampton", "Burlington", "Cambridge", "Clarington", "Etobicoke", "Guelph", "Hamilton", "Kingston", "Kitchener", "London", "Markham", "Milton", "Mississauga", "Newmarket", "Niagara Falls", "North Bay", "Oakville", "Oshawa", "Ottawa", "Peterborough", "Pickering", "Scarborough", "St. Catharines", "Thunder Bay", "Toronto", "Vaughan", "Waterloo", "Whitby", "Windsor"],
  "Prince Edward Island": ["Charlottetown", "Stratford", "Summerside"],
  "Quebec": ["Brossard", "Drummondville", "Gatineau", "Laval", "Levis", "Longueuil", "Montreal", "Quebec City", "Repentigny", "Saguenay", "Sherbrooke", "Trois-Rivières", "Terrebonne"],
  "Saskatchewan": ["Moose Jaw", "Prince Albert", "Regina", "Saskatoon", "Swift Current", "Yorkton"],
  "Yukon": ["Dawson City", "Whitehorse"]
};

// DOM 引用
const form = document.getElementById("upload-form");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");

// 地址选择元素
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");
const pickupProvinceSelect = document.getElementById("pickup_province");
const pickupCitySelect = document.getElementById("pickup_city");

// 加载 Seller & Pickup 省份
for (const province in provinceCityMap) {
  const option1 = document.createElement("option");
  option1.value = province;
  option1.textContent = province;
  provinceSelect.appendChild(option1);

  const option2 = document.createElement("option");
  option2.value = province;
  option2.textContent = province;
  pickupProvinceSelect.appendChild(option2);
}

// 城市联动逻辑
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

pickupProvinceSelect.addEventListener("change", () => {
  const cities = provinceCityMap[pickupProvinceSelect.value] || [];
  pickupCitySelect.innerHTML = '<option value="">Select City</option>';
  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    pickupCitySelect.appendChild(option);
  });
});

// 用户状态 & 会员校验
let currentUser = null;
let isMember = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }
  currentUser = user;
  const ref = doc(db, "memberships", user.uid);
  const snap = await getDoc(ref);
  const paidUntil = snap.data()?.paid_until?.seconds * 1000;

  if (paidUntil && paidUntil > Date.now()) {
    isMember = true;
  } else {
    message.innerText = "⛔️ You must be a member to upload products.";
    form.style.display = "none";
  }
});

// 提交上传
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
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  const endsAt = new Date(endsAtRaw);

  // 地址信息
  const shippingEnabled = form["shipping_enabled"].checked;
  const pickupEnabled = form["pickup_enabled"].checked;
  const shippingFee = shippingEnabled ? parseFloat(form["shipping_fee"].value) || 0 : 0;

  if (shippingEnabled && isNaN(shippingFee)) {
    message.innerText = "❌ Please enter a valid shipping fee.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  const country = form["country"].value;
  const province = form["province"].value;
  const city = form["city"].value;

  if (!country || !province || !city) {
    message.innerText = "❌ Please select your shipping address.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  // ✅ Pickup 地址结构化
  let pickupAddress = null;
  if (pickupEnabled) {
    const pCountry = form["pickup_country"].value;
    const pProvince = form["pickup_province"].value;
    const pCity = form["pickup_city"].value;

    if (!pCountry || !pProvince || !pCity) {
      message.innerText = "❌ Please select your pickup address.";
      submitBtn.disabled = false;
      submitBtn.innerText = "✅ Upload Product";
      return;
    }

    pickupAddress = { country: pCountry, province: pProvince, city: pCity };
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
      current_bid: price,
      bids: [],
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
  } catch (err) {
    console.error("❌ Upload failed:", err);
    message.style.color = "red";
    message.innerText = "❌ Upload failed. Try again.";
  }

  submitBtn.disabled = false;
  submitBtn.innerText = "✅ Upload Product";
});

// 显示隐藏切换
document.getElementById("shipping_enabled").addEventListener("change", (e) => {
  document.getElementById("shipping-fee-group").classList.toggle("hidden", !e.target.checked);
});
document.getElementById("pickup_enabled").addEventListener("change", (e) => {
  document.getElementById("pickup-address-group").classList.toggle("hidden", !e.target.checked);
});
