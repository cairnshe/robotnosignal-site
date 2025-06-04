// ✅ login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config-raw.js";

// ✅ 初始化 Firebase 应用
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ 登录逻辑主函数（必须封装在 async 函数中）
async function setupLogin() {
  try {
    await setPersistence(auth, browserSessionPersistence);
    console.log("✅ Session persistence set.");

    const form = document.getElementById("login-form");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      message.style.color = "black";
      message.innerText = "⏳ Logging in...";

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login succeeded:", userCred.user);

        message.style.color = "green";
        message.innerText = "Login successful. Redirecting...";

        // ✅ 等待 Firebase 确认登录状态
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log("👀 Auth state changed:", user);
          if (user) {
            unsubscribe(); // 停止监听
            setTimeout(() => {
              window.location.href = "/shop.html";
            }, 1000); // 给用户1秒看提示
          }
        });

      } catch (error) {
        console.error("❌ Login error:", error);
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

  } catch (err) {
    console.error("❌ Failed to set persistence:", err);
    const message = document.getElementById("message");
    message.style.color = "red";
    message.innerText = "Internal error during setup.";
  }
}

// ✅ 启动登录逻辑
setupLogin();
