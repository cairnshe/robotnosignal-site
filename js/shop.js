console.log("✅ shop.html script started");

import { db, auth } from '../firebase-config.js';
console.log("✅ Firebase modules imported", auth);

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

console.log("📡 Listening for auth state change...");

let currentUser = null;
let isMember = false;
const list = document.getElementById('product-list');

function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function startCountdown(elementId, endTime) {
  const el = document.getElementById(elementId);
  const timer = setInterval(() => {
    const now = Date.now();
    const diff = endTime - now;
    if (diff <= 0) {
      clearInterval(timer);
      el.innerText = 'Expired';
    } else {
      el.innerText = formatCountdown(diff);
    }
  }, 1000);
}

onAuthStateChanged(auth, async (user) => {
  console.log("👀 onAuthStateChanged fired. User:", user);
  currentUser = user;
  isMember = false;

  if (user) {
    console.log("🔍 UID is:", user.uid);
    try {
      const ref = doc(db, "memberships", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const paidUntil = snap.data().paid_until;
        console.log("📅 paid_until timestamp:", paidUntil);
        if (paidUntil?.seconds * 1000 > Date.now()) {
          isMember = true;
        }
      } else {
        console.warn("⚠️ No membership document found for this user.");
      }
    } catch (e) {
      console.error("❌ Error checking membership:", e);
    }
  }

  console.log("✅ Current user:", currentUser?.email || "None");
  console.log("✅ Is member:", isMember);
  loadProducts();
});

async function loadProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    console.log("📦 Raw Firestore docs:", querySnapshot.size);
    const products = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({ id: docSnap.id, ...data });
    });

    products.sort((a, b) => a.ends_at?.seconds - b.ends_at?.seconds);
    const now = Date.now();
    const ongoing = products.filter(p => p.ends_at?.seconds * 1000 > now);
    list.innerHTML = '';

    ongoing.forEach((product) => {
      const endsAt = product.ends_at.seconds * 1000;
      const timeLeft = endsAt - now;
      const item = document.createElement('div');
      item.className = 'product';

      const bids = product.bids || [];
      const highest = bids.length ? bids[bids.length - 1].amount : product.starting_bid || 0;

      item.innerHTML = `
        <h2>${product.name}</h2>
        <img src="${product.image_url}" alt="${product.name}" />
        <p><strong>Starting Price:</strong> $${product.price}</p>
        <p><strong>Current Price:</strong> $${highest}</p>
        <p>${product.description}</p>
        <p><strong>Seller:</strong> ${product.seller_name}</p>
        <p><strong>Ends in:</strong> <span class="countdown" id="cd-${product.id}">${formatCountdown(timeLeft)}</span></p>
        <div class="bid-input">
          <input type="number" placeholder="Your bid..." id="input-${product.id}" />
          <button onclick="placeBid('${product.id}', ${highest})">Place Bid</button>
        </div>
        <p class="error" id="error-${product.id}"></p>
        <div class="history">
          <a href="#" onclick="toggleHistory('${product.id}'); return false;">Show Bid History</a>
          <ul id="history-${product.id}" style="display:none; margin-top:0.5rem;"></ul>
        </div>
      `;

      list.appendChild(item);
      startCountdown(`cd-${product.id}`, endsAt);

      const historyEl = item.querySelector(`#history-${product.id}`);
      if (bids.length) {
        bids.slice().reverse().forEach(b => {
          const li = document.createElement('li');
          const date = new Date(b.timestamp?.seconds * 1000 || Date.now());
          li.innerText = `${b.bidder || 'Anonymous'} bid $${b.amount} at ${date.toLocaleString()}`;
          historyEl.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.innerText = "No bids yet.";
        historyEl.appendChild(li);
      }

      const input = item.querySelector(`#input-${product.id}`);
      const btn = item.querySelector('button');
      const err = item.querySelector(`#error-${product.id}`);

      if (!isMember) {
        input.disabled = true;
        btn.disabled = true;
        err.innerHTML = `Log in / <a href='/signup'>Sign up</a> before bidding!`;
      } else {
        input.disabled = false;
        btn.disabled = false;
        err.innerHTML = '';
      }
    });

  } catch (error) {
    console.error('❌ Error loading products:', error);
    list.innerText = 'Failed to load products.';
  }
}

window.placeBid = async function(productId, currentBid) {
  const input = document.getElementById(`input-${productId}`);
  const error = document.getElementById(`error-${productId}`);
  const amount = parseFloat(input.value);

  let minIncrement = 1;
  if (currentBid >= 100) {
    minIncrement = 4;
  } else if (currentBid >= 50) {
    minIncrement = 2;
  }

  const minRequired = currentBid + minIncrement;

  if (isNaN(amount) || amount < minRequired) {
    error.innerText = `Your bid must be at least $${minRequired.toFixed(2)}`;
    return;
  }

  try {
    const productRef = doc(db, "products", productId);
    await updateDoc(productRef, {
      current_bid: amount,
      bids: arrayUnion({
        amount,
        bidder: currentUser?.email || "anonymous",
        timestamp: new Date()
      })
    });
    error.innerText = '';
    input.value = '';
    location.reload();
  } catch (err) {
    console.error(err);
    error.innerText = "Error placing bid.";
  }
};

window.toggleHistory = function(id) {
  const el = document.getElementById(`history-${id}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
