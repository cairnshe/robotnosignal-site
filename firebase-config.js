// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbrc6FV024PCp9SDlJ_-Y5QpbxdqvTYJI",
  authDomain: "robot-no-signal.firebaseapp.com",
  projectId: "robot-no-signal",
  storageBucket: "robot-no-signal.appspot.com",
  messagingSenderId: "485194816357",
  appId: "1:485194816357:web:fc33550bd299927266df8c",
  measurementId: "G-QQRM0D4RB9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
