import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const submitBtn = document.getElementById("submit-payment");
const successMsg = document.getElementById("success-msg");
const errorMsg = document.getElementById("error-msg");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/login.html";
  }
});

submitBtn.addEventListener("click", async () => {
  successMsg.style.display = 'none';
  errorMsg.style.display = 'none';

  const payerName = document.getElementById("payer-name").value.trim();
  const paymentDate = document.getElementById("payment-date").value;
  const remarks = document.getElementById("remarks").value.trim();

  if (!payerName || !paymentDate) {
    errorMsg.innerText = "❌ Please fill out required fields.";
    errorMsg.style.display = 'block';
    return;
  }

  try {
    await addDoc(collection(db, "membership_payments"), {
      user_uid: auth.currentUser.uid,
      user_email: auth.currentUser.email,
      payer_name: payerName,
      payment_date: paymentDate,
      remarks: remarks,
      submitted_at: new Date()
    });

    successMsg.style.display = 'block';
    document.getElementById("payer-name").value = '';
    document.getElementById("payment-date").value = '';
    document.getElementById("remarks").value = '';
  } catch (err) {
    console.error("Failed to submit payment info:", err);
    errorMsg.innerText = "❌ Failed to submit payment info.";
    errorMsg.style.display = 'block';
  }
});
