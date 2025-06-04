// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

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

// ✅ 设置登录状态仅在当前标签页有效
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log("✅ Auth persistence set to session only");
  })
  .catch((error) => {
    console.error("❌ Persistence error:", error);
  });

export { app, db, auth };
