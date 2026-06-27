(function () {
  "use strict";

  const form = document.querySelector("[data-wholesale-application-form]");
  const submit = document.querySelector("[data-wholesale-submit]");
  const status = document.querySelector("[data-wholesale-status]");

  if (!form) return;

  function setStatus(message, state) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state || "";
  }

  function setSubmitting(isSubmitting) {
    if (!submit) return;
    submit.disabled = isSubmitting;
    submit.textContent = isSubmitting ? "Submitting..." : "Submit application";
  }

  function payloadFromForm() {
    const fd = new FormData(form);
    const payload = {};
    for (const [key, value] of fd.entries()) {
      if (key === "desired_products") continue;
      payload[key] = typeof value === "string" ? value.trim() : value;
    }
    payload.desired_products = fd
      .getAll("desired_products")
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    payload.consent = fd.get("consent") === "on";
    payload.source_page = window.location.pathname;
    payload.submitted_timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return payload;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!form.querySelector("[name='desired_products']:checked")) {
      setStatus("Select at least one product category.", "error");
      const firstProduct = form.querySelector("[name='desired_products']");
      if (firstProduct) firstProduct.focus();
      return;
    }

    setSubmitting(true);
    setStatus("Submitting application...", "pending");

    try {
      const response = await fetch("/api/wholesale/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadFromForm()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "We could not submit this application.");
      }

      setStatus(
        data.message || "Application received. We will reply by email after review.",
        "success"
      );
      form.reset();
      const country = form.querySelector("[name='country']");
      if (country) country.value = "US";
    } catch (error) {
      setStatus(
        error.message || "We could not submit this application.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  });
})();
