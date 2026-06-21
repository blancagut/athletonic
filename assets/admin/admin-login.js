// Admin email/password login page controller.
import { supabase } from "./admin-core.js";

const form = document.getElementById("admin-login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("auth-message");

function setMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = "admin-auth-message" + (kind ? ` is-${kind}` : "");
}

// If a session already exists, go to the app.
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) {
    window.location.replace("./index.html");
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage("Enter a valid email address.", "error");
    return;
  }
  if (!password) {
    setMessage("Enter your admin password.", "error");
    return;
  }

  submitBtn.disabled = true;
  setMessage("Signing in...", "");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  submitBtn.disabled = false;

  if (error) {
    setMessage(error.message || "Could not sign in.", "error");
    return;
  }

  setMessage("Signed in. Opening the dashboard...", "success");
  window.location.replace("./index.html");
});
