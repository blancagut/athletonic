(function () {
  const form = document.querySelector("[data-order-lookup-form]");
  const statusEl = document.querySelector("[data-order-lookup-status]");
  const resultEl = document.querySelector("[data-order-lookup-result]");

  function setStatus(message, state) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.state = state || "";
  }

  function formatMoney(cents, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format((Number(cents) || 0) / 100);
  }

  function formatDate(value) {
    if (!value) return "Pending";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderOrder(order) {
    resultEl.hidden = false;
    resultEl.innerHTML = `
      <div class="order-result-header">
        <div>
          <span class="order-kicker">Order ${escapeHtml(order.order_reference)}</span>
          <h2>${escapeHtml(order.order_status.replaceAll("_", " "))}</h2>
          <p>Placed ${formatDate(order.timestamps.created_at)}</p>
        </div>
        <strong>${formatMoney(order.amounts.total_cents, order.currency)}</strong>
      </div>
      <div class="order-status-grid">
        <span><small>Payment</small>${escapeHtml(order.payment_status.replaceAll("_", " "))}</span>
        <span><small>Fulfillment</small>${escapeHtml(order.fulfillment_status.replaceAll("_", " "))}</span>
        <span><small>Tracking</small>${
          order.tracking.url
            ? `<a href="${escapeHtml(order.tracking.url)}" rel="noopener">Track shipment</a>`
            : escapeHtml(order.tracking.number || "Not shipped yet")
        }</span>
      </div>
      <div class="order-lines">
        ${order.items
          .map(
            (item) => `
              <article class="order-line">
                ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="">` : ""}
                <div>
                  <h3>${escapeHtml(item.name)}${item.variant ? ` - ${escapeHtml(item.variant)}` : ""}</h3>
                  <p>${escapeHtml(item.brand)} · Qty ${item.quantity}</p>
                </div>
                <strong>${formatMoney(item.line_subtotal_cents, item.currency)}</strong>
              </article>
            `
          )
          .join("")}
      </div>
      <ol class="order-timeline">
        ${order.events
          .map(
            (event) => `
              <li>
                <strong>${escapeHtml(event.status.replaceAll("_", " "))}</strong>
                <span>${escapeHtml(event.message || "")}</span>
                <time>${formatDate(event.created_at)}</time>
              </li>
            `
          )
          .join("")}
      </ol>
      <div class="commerce-actions">
        <a href="./returns-request.html?order_reference=${encodeURIComponent(
          order.order_reference
        )}&email=${encodeURIComponent(order.customer_email)}">Start a return or replacement</a>
      </div>
    `;
  }

  async function lookupOrder(email, reference) {
    const response = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, order_reference: reference }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Order not found.");
    return data.order;
  }

  if (form) {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const reference = params.get("order_reference") || params.get("reference");
    if (email) form.elements.email.value = email;
    if (reference) form.elements.order_reference.value = reference;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lookupEmail = String(data.get("email") || "").trim();
      const lookupReference = String(data.get("order_reference") || "").trim();
      setStatus("Looking up order...", "pending");
      resultEl.hidden = true;

      try {
        const order = await lookupOrder(lookupEmail, lookupReference);
        setStatus("Order found.", "success");
        renderOrder(order);
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  }
})();
