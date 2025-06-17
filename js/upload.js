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

// 🌎 完整省市数据映射
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

const form = document.getElementById("upload-form");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submit-btn");
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");
const pickupProvinceSelect = document.getElementById("pickup_province");
const pickupCitySelect = document.getElementById("pickup_city");

// 加载所有省份
for (const province of Object.keys(provinceCityMap).sort()) {
  const option1 = document.createElement("option");
  option1.value = province;
  option1.textContent = province;
  provinceSelect.appendChild(option1);

  const option2 = document.createElement("option");
  option2.value = province;
  option2.textContent = province;
  pickupProvinceSelect.appendChild(option2);
}

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

let currentUser = null;
let isMember = false;

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

  const shippingEnabled = form["shipping_enabled"].checked;
  const pickupEnabled = form["pickup_enabled"].checked;
  const shippingFee = shippingEnabled ? parseFloat(form["shipping_fee"].value) || 0 : 0;
  const pickupCountry = pickupEnabled ? form["pickup_country"].value : "";
  const pickupProvince = pickupEnabled ? form["pickup_province"].value : "";
  const pickupCity = pickupEnabled ? form["pickup_city"].value : "";

  const pickupAddress = pickupEnabled ? { country: pickupCountry, province: pickupProvince, city: pickupCity } : null;

  if (shippingEnabled && isNaN(parseFloat(form["shipping_fee"].value))) {
    message.innerText = "❌ Please enter a valid shipping fee.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

  if (pickupEnabled && (!pickupCountry || !pickupProvince || !pickupCity)) {
    message.innerText = "❌ Please select pickup location.";
    submitBtn.disabled = false;
    submitBtn.innerText = "✅ Upload Product";
    return;
  }

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
