(function () {
  const CART_STORAGE_KEY = "athletonic-cart-v1";
  const LAST_ORDER_REFERENCE_KEY = "athletonic-last-order-reference";

  const statusEl = document.querySelector("[data-confirmation-status]");
  const summaryEl = document.querySelector("[data-order-summary]");
  const itemsEl = document.querySelector("[data-order-items]");
  const timelineEl = document.querySelector("[data-order-timeline]");
  const referenceEl = document.querySelector("[data-order-reference]");
  const emailEl = document.querySelector("[data-order-email]");

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

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
    if (!order) return;

    if (referenceEl) referenceEl.textContent = order.order_reference;
    if (emailEl) emailEl.textContent = order.customer_email;

    const paid = ["paid", "processing", "shipped", "delivered"].includes(
      order.order_status
    );
    setStatus(
      paid
        ? "Payment confirmed. Your order is now in Athletonic's fulfillment queue."
        : "Payment is still being confirmed. This page will refresh automatically for a moment.",
      paid ? "success" : "pending"
    );

    if (paid) {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.setItem(LAST_ORDER_REFERENCE_KEY, order.order_reference);
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <dl class="order-totals">
          <div><dt>Subtotal</dt><dd>${formatMoney(order.amounts.subtotal_cents, order.currency)}</dd></div>
          <div><dt>Shipping</dt><dd>${formatMoney(order.amounts.shipping_cents, order.currency)}</dd></div>
          <div><dt>Taxes</dt><dd>${formatMoney(order.amounts.tax_cents, order.currency)}</dd></div>
          <div><dt>Total</dt><dd>${formatMoney(order.amounts.total_cents, order.currency)}</dd></div>
        </dl>
        <div class="order-status-grid">
      <span><small>Order</small>${escapeHtml(order.order_status.replaceAll("_", " "))}</span>
      <span><small>Payment</small>${escapeHtml(order.payment_status.replaceAll("_", " "))}</span>
      <span><small>Fulfillment</small>${escapeHtml(order.fulfillment_status.replaceAll("_", " "))}</span>
        </div>
      `;
    }

    if (itemsEl) {
      itemsEl.innerHTML = order.items
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
        .join("");
    }

    if (timelineEl) {
      const events = order.events.length
        ? order.events
        : [
            {
              status: order.order_status,
              message: "Order created.",
              created_at: order.timestamps.created_at,
            },
          ];
      timelineEl.innerHTML = events
        .map(
          (event) => `
            <li>
              <strong>${escapeHtml(event.status.replaceAll("_", " "))}</strong>
              <span>${escapeHtml(event.message || "")}</span>
              <time>${formatDate(event.created_at)}</time>
            </li>
          `
        )
        .join("");
    }
  }

  async function loadOrder(attempt) {
    if (!sessionId) {
      setStatus("Missing Stripe session id. Use order tracking with your reference.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/api/orders/session?session_id=${encodeURIComponent(sessionId)}`
      );
      if (!response.ok) throw new Error("Order is not available yet.");
      const data = await response.json();
      renderOrder(data.order);

      if (data.order.order_status === "pending_payment" && attempt < 8) {
        window.setTimeout(() => loadOrder(attempt + 1), 2500);
      }
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  loadOrder(0);
})();
