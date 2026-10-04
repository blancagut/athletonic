(() => {
  "use strict";

  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const status = document.querySelector("[data-contact-status]");
  const submit = document.querySelector("[data-contact-submit]");
  const startedAt = form.querySelector("[data-form-started]");
  if (startedAt) startedAt.value = String(Date.now());
  const spanish = document.documentElement.lang.toLowerCase().startsWith("es");
  const copy = spanish
    ? { sending: "Enviando…", success: "Gracias por escribirnos. Tu mensaje se envió correctamente.", error: "No pudimos enviar tu mensaje. Inténtalo de nuevo en un momento.", invalid: "Revisa tu correo electrónico e inténtalo de nuevo." }
    : { sending: "Sending…", success: "Thanks for contacting us. Your message has been sent.", error: "We couldn’t send your message. Please try again in a moment.", invalid: "Please check your email address and try again." };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.dataset.state = "";

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    if (String(data.company || "").trim()) {
      status.textContent = copy.success;
      status.dataset.state = "success";
      form.reset();
      return;
    }

    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.firstChild.textContent = copy.sending;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || copy.error);

      status.textContent = copy.success;
      status.dataset.state = "success";
      form.reset();
    } catch (error) {
      status.textContent = copy.error;
      status.dataset.state = "error";
    } finally {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.firstChild.textContent = spanish ? "Enviar mensaje" : "Send message";
    }
  });
})();
