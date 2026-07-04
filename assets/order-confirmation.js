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
  const sessionId = params.get("session_id");
  const transferReference = String(params.get("order_reference") || "").trim();
  const isTransferOrder = params.get("transfer") === "1" || (transferReference && !sessionId);

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
          <div><dt>${isBankTransfer ? "Cart subtotal" : "Subtotal"}</dt><dd>${formatMoney(amounts.subtotal_cents, order.currency)}</dd></div>
          <div><dt>Shipping</dt><dd>${isBankTransfer ? "To be confirmed" : formatMoney(amounts.shipping_cents, order.currency)}</dd></div>
          <div><dt>Taxes</dt><dd>${isBankTransfer ? "To be confirmed" : formatMoney(amounts.tax_cents, order.currency)}</dd></div>
          <div><dt>${isBankTransfer ? "Estimated item total" : "Total"}</dt><dd>${formatMoney(amounts.total_cents, order.currency)}</dd></div>
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
      renderTransferOrder();
      return;
    }

    if (!sessionId) {
      setStatus("Use order tracking with your Athletonic reference.", "error");
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

  function renderTransferOrder() {
    const stored = storedTransferOrder(transferReference);
    if (stored) {
      renderOrder(stored);
      return;
    }

    const reference =
      transferReference || localStorage.getItem(LAST_ORDER_REFERENCE_KEY) || "Pending";
    const email = localStorage.getItem(GUEST_EMAIL_KEY) || "Your checkout email";
    renderOrder({
      order_reference: reference,
      customer_email: email,
      currency: "USD",
      payment_method: "bank_transfer",
      payment_status: "pending",
      order_status: "pending_payment",
      fulfillment_status: "not_started",
      amounts: {},
      timestamps: {
        created_at: new Date().toISOString(),
      },
      items: [],
      events: [],
    });
  }
})();
