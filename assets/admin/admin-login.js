// Magic-link login page controller.
import { supabase } from "./admin-core.js";

const form = document.getElementById("magic-form");
const emailInput = document.getElementById("email");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("auth-message");

const REDIRECT_TO = new URL("./index.html", window.location.href).href;

function setMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = "admin-auth-message" + (kind ? ` is-${kind}` : "");
}

// If a magic link just landed here (or a session already exists), go to the app.
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) {
    window.location.replace("./index.html");
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage("Enter a valid email address.", "error");
    return;
  }

  submitBtn.disabled = true;
  setMessage("Sending…", "");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: REDIRECT_TO,
      shouldCreateUser: false,
    },
  });

  submitBtn.disabled = false;

  if (error) {
    setMessage(error.message || "Could not send the magic link.", "error");
    return;
  }

  setMessage(
    "Check your inbox — we sent a secure sign-in link to " + email + ".",
    "success"
  );
  form.reset();
});
