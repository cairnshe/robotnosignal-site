// /js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
// ✅ 新增：Storage
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbrc6FV024PCp9SDlJ_-Y5QpbxdqvTYJI",
  authDomain: "robot-no-signal.firebaseapp.com",
  projectId: "robot-no-signal",
  // ✅ 必须有；与你控制台 Storage 显示一致即可
  storageBucket: "robot-no-signal.appspot.com",
  messagingSenderId: "485194816357",
  appId: "1:485194816357:web:fc33550bd299927266df8c",
  measurementId: "G-QQRM0D4RB9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// ✅ 新增：导出同一个 storage 实例（用同一个 app）
const storage = getStorage(app);

// 仅在当前标签页保持登录态
setPersistence(auth, browserSessionPersistence)
  .then(() => console.log("✅ Auth persistence set to session only"))
  .catch((error) => console.error("❌ Persistence error:", error));

export { app, db, auth, storage }; // ✅ 这里把 storage 也导出去
