import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../firebase-config.js";

// ✅ 放进异步初始化函数中（防止顶层 await 错误）
async function initLogin() {
  try {
    await setPersistence(auth, browserSessionPersistence);
    console.log("✅ Session-only auth persistence set");

    // ✅ 表单逻辑
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

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log("✅ Auth state confirmed. Redirecting to /shop.html");
            unsubscribe();
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
  } catch (e) {
    console.error("❌ Error setting auth persistence:", e);
    document.getElementById("message").innerText = "Auth setup failed. Try again.";
  }
}

// ✅ 启动
initLogin();
