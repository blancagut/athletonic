(function () {
  const CART_STORAGE_KEY = "athletonic-cart-v1";
  const LAST_ORDER_REFERENCE_KEY = "athletonic-last-order-reference";
  const GUEST_EMAIL_KEY = "athletonic-guest-email";
  const LAST_TRANSFER_ORDER_KEY = "athletonic-last-transfer-order";

  const statusEl = document.querySelector("[data-confirmation-status]");
  const summaryEl = document.querySelector("[data-order-summary]");
  const itemsEl = document.querySelector("[data-order-items]");
  const timelineEl = document.querySelector("[data-order-timeline]");
  const referenceEl = document.querySelector("[data-order-reference]");
  const emailEl = document.querySelector("[data-order-email]");

  const params = new URLSearchParams(window.location.search);
  const transferReference = String(params.get("order_reference") || "").trim();
  const isTransferOrder = params.get("transfer") === "1" || Boolean(transferReference);

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

    const orderItems = Array.isArray(order.items) ? order.items : [];
    const orderEvents = Array.isArray(order.events) ? order.events : [];
    const amounts = order.amounts || {};
    const timestamps = order.timestamps || {};
    const isBankTransfer = order.payment_method === "bank_transfer";

    if (referenceEl) referenceEl.textContent = order.order_reference || "Pending";
    if (emailEl) emailEl.textContent = order.customer_email || "Your checkout email";

    const paid = ["paid", "processing", "shipped", "delivered"].includes(
      order.order_status
    );
    setStatus(
      isBankTransfer
        ? order.customer_email_sent === false
          ? "Order received. Athletonic sales will follow up with the final cost and bank transfer instructions."
          : "Order received. We will email the final cost and bank transfer instructions."
        : paid
        ? "Payment confirmed. Your order is now in Athletonic's fulfillment queue."
        : "Payment is still being confirmed. This page will refresh automatically for a moment.",
      isBankTransfer || paid ? "success" : "pending"
    );

    if (isBankTransfer || paid) {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.setItem(LAST_ORDER_REFERENCE_KEY, order.order_reference);
    }

    if (summaryEl) {
      summaryEl.innerHTML = `
        <dl class="order-totals">
          <div><dt>Subtotal</dt><dd>${formatMoney(amounts.subtotal_cents, order.currency)}</dd></div>
          ${Number(amounts.discount_cents || 0) ? `<div><dt>Discount</dt><dd>-${formatMoney(amounts.discount_cents, order.currency)}</dd></div>` : ""}
          <div><dt>Shipping</dt><dd>${formatMoney(amounts.shipping_cents, order.currency)}</dd></div>
          ${Number(amounts.tax_cents || 0) ? `<div><dt>Tax</dt><dd>${formatMoney(amounts.tax_cents, order.currency)}</dd></div>` : ""}
          <div><dt>Final total</dt><dd>${formatMoney(amounts.total_cents, order.currency)}</dd></div>
        </dl>
        <div class="order-status-grid">
      <span><small>Order</small>${escapeHtml(String(order.order_status || "pending_payment").replaceAll("_", " "))}</span>
      <span><small>Payment</small>${escapeHtml(isBankTransfer ? "bank transfer pending" : String(order.payment_status || "pending").replaceAll("_", " "))}</span>
      <span><small>Fulfillment</small>${escapeHtml(String(order.fulfillment_status || "not_started").replaceAll("_", " "))}</span>
        </div>
      `;
    }

    if (itemsEl) {
      itemsEl.innerHTML = orderItems.length
        ? orderItems
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
            .join("")
        : '<p class="commerce-muted">Your itemized order has been sent by email.</p>';
    }

    if (timelineEl) {
      const events = orderEvents.length
        ? orderEvents
        : [
            {
              status: order.order_status,
              message: isBankTransfer
                ? order.customer_email_sent === false
                  ? "Order received; Athletonic sales will follow up with the final cost and bank transfer instructions."
                  : "Order received; final cost and bank transfer instructions will be sent by email."
                : "Order created.",
              created_at: timestamps.created_at,
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
    if (isTransferOrder) {
      await renderTransferOrder();
      return;
    }

    setStatus("Use order tracking with your Athletonic reference.", "error");
  }

  function storedTransferOrder(reference) {
    try {
      const parsed = JSON.parse(localStorage.getItem(LAST_TRANSFER_ORDER_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (reference && parsed.order_reference !== reference) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function renderTransferOrder() {
    const stored = storedTransferOrder(transferReference);
    const reference =
      transferReference || (stored && stored.order_reference) || localStorage.getItem(LAST_ORDER_REFERENCE_KEY) || "";
    const email = String((stored && stored.customer_email) || localStorage.getItem(GUEST_EMAIL_KEY) || "").trim();
    if (referenceEl) referenceEl.textContent = reference || "Pending";
    if (emailEl) emailEl.textContent = email || "Your checkout email";
    setStatus("Verifying your stored order…", "pending");

    if (!reference || !email) {
      setStatus("This order cannot be verified. Use order tracking with your reference and checkout email.", "error");
      return;
    }

    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_reference: reference, email: email }),
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || !payload.order) throw new Error("order_not_verified");
      renderOrder(payload.order);
    } catch {
      setStatus("This order cannot be verified. Use order tracking with your reference and checkout email.", "error");
      if (summaryEl) summaryEl.innerHTML = "";
      if (itemsEl) itemsEl.innerHTML = "";
      if (timelineEl) timelineEl.innerHTML = "";
    }
  }

  loadOrder(0);
})();
