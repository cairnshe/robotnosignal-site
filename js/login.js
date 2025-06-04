import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config-raw.js"; // 确保路径正确

// ✅ 初始化 Firebase 应用
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ 设置 session-only 登录（关闭浏览器即登出）
await setPersistence(auth, browserSessionPersistence);

// ✅ 登录表单逻辑
const form = document.getElementById("login-form");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful. Waiting for confirmation...");
    message.style.color = "green";
    message.innerText = "Login successful. Redirecting...";

    // ✅ 等待 Firebase 登录状态变更确认再跳转
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("✅ Auth state confirmed. Redirecting to /shop.html");
        unsubscribe(); // 停止监听
        window.location.href = "/shop.html";
      }
    });
  } catch (error) {
    console.error("❌ Login failed:", error);
    message.style.color = "red";

    if (error.code === "auth/user-not-found") {
      message.innerText = "No user found with this email.";
    } else if (error.code === "auth/wrong-password") {
      message.innerText = "Incorrect password. Please try again.";
    } else {
      message.innerText = "Login failed: " + error.message;
    }
  }
});
