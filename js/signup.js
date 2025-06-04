// signup.js
import {
  createUserWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { auth } from "../firebase-config.js";  // 相对路径根据你实际目录可能需要调整

// 设置为 session-only（关闭浏览器后自动登出）
await setPersistence(auth, browserSessionPersistence);

// 获取 DOM 元素
const form = document.getElementById("signup-form");
const message = document.getElementById("message");

// 监听注册表单提交
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    message.style.color = "green";
    message.innerText = "🎉 Signup successful! Redirecting...";
    console.log("✅ Signup successful. Redirecting to /shop.html");
    setTimeout(() => {
      window.location.href = "/shop.html";
    }, 1000);
  } catch (error) {
    console.error("❌ Signup failed:", error);
    message.style.color = "red";
    if (error.code === "auth/email-already-in-use") {
      message.innerText = "Email is already in use.";
    } else if (error.code === "auth/weak-password") {
      message.innerText = "Password should be at least 6 characters.";
    } else {
      message.innerText = "Signup failed: " + error.message;
    }
  }
});
