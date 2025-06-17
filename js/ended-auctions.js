// js/ended-auctions.js

function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const maskedName = name.length <= 2
    ? name[0] + '*'
    : name.slice(0, 2) + '*'.repeat(name.length - 2);
  return maskedName + '@' + domain;
}

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const list = document.getElementById('ended-product-list');

let endedProducts = []; // 🔁 全局缓存 ended 商品数据

// 🔍 搜索框监听器
document.getElementById('search-input').addEventListener('input', renderFilteredAndSorted);

// 🔃 排序选择监听器
document.getElementById('sort-select').addEventListener('change', renderFilteredAndSorted);


async function loadEndedAuctions() {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const now = Date.now();
    const ended = [];

    querySnapshot.forEach(doc => {
      const data = doc.data();
      const endsAt = data.ends_at?.seconds * 1000;
      if (endsAt && endsAt <= now) {
        ended.push({ id: doc.id, ...data });
      }
    });

    ended.sort((a, b) => a.ends_at.seconds - b.ends_at.seconds);
    list.innerHTML = '';

    ended.forEach(product => {
     const hasWinner = product.current_bid > 0 && !!product.current_bidder;
const finalPrice = hasWinner ? product.current_bid : 0;

const item = document.createElement('div');
item.className = 'product';

item.innerHTML = `
  <h2>${product.name}</h2>
  <img src="${product.image_url}" alt="${product.name}" />
  <p>${product.description}</p>
  <p><strong>Seller:</strong> ${product.seller_name}</p>
  <p><strong>Ended at:</strong> ${new Date(product.ends_at.seconds * 1000).toLocaleString()}</p>
  <p><strong>Final Price:</strong> $${finalPrice}</p>
  <p class="${hasWinner ? 'status' : 'unsold'}">
    ${hasWinner
      ? `Sold to ${maskEmail(product.current_bidder)} for $${product.current_bid}`
      : 'No bids placed – Unsold'}
  </p>
`;


      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading ended auctions:', error);
    list.innerText = 'Failed to load ended auctions.';
  }
}

loadEndedAuctions();
