(function () {
  const lookupForm = document.querySelector("[data-return-lookup-form]");
  const requestForm = document.querySelector("[data-return-request-form]");
  const statusEl = document.querySelector("[data-return-status]");
  const itemSelect = document.querySelector("[data-return-item]");
  const quantityInput = document.querySelector("[data-return-quantity]");
  const orderSummary = document.querySelector("[data-return-order-summary]");
  let currentOrder = null;

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

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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

  function renderOrder(order) {
    currentOrder = order;
    requestForm.hidden = false;
    itemSelect.innerHTML = order.items
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}" data-max="${item.quantity}">${escapeHtml(item.name)}${
            item.variant ? ` - ${escapeHtml(item.variant)}` : ""
          } · ${formatMoney(item.line_subtotal_cents, item.currency)}</option>`
      )
      .join("");

    if (quantityInput) quantityInput.max = order.items[0]?.quantity || 1;

    if (orderSummary) {
      orderSummary.innerHTML = `
        <span class="order-kicker">Order ${escapeHtml(order.order_reference)}</span>
        <h2>${escapeHtml(order.order_status.replaceAll("_", " "))}</h2>
        <p>${order.items.length} item${order.items.length === 1 ? "" : "s"} · ${formatMoney(
        order.amounts.total_cents,
        order.currency
      )}</p>
      `;
    }
  }

  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          data: reader.result,
        });
      reader.onerror = () => reject(new Error("Could not read one photo."));
      reader.readAsDataURL(file);
    });
  }

  async function collectPhotos(input) {
    const files = Array.from(input.files || []).slice(0, 3);
    return Promise.all(files.map(readPhoto));
  }

  if (lookupForm) {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const reference = params.get("order_reference") || params.get("reference");
    if (email) lookupForm.elements.email.value = email;
    if (reference) lookupForm.elements.order_reference.value = reference;

    lookupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(lookupForm);
      setStatus("Finding order...", "pending");
      requestForm.hidden = true;

      try {
        const order = await lookupOrder(
          String(data.get("email") || "").trim(),
          String(data.get("order_reference") || "").trim()
        );
        setStatus("Order found. Choose the item and reason.", "success");
        renderOrder(order);
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  }

  if (itemSelect && quantityInput) {
    itemSelect.addEventListener("change", () => {
      const selected = itemSelect.selectedOptions[0];
      quantityInput.max = selected?.dataset.max || 1;
      quantityInput.value = "1";
    });
  }

  if (requestForm) {
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentOrder) return;

      const lookupData = new FormData(lookupForm);
      const requestData = new FormData(requestForm);
      const photos = await collectPhotos(requestForm.elements.photos);
      const selectedItemId = String(requestData.get("item") || "");
      setStatus("Sending return request...", "pending");

      try {
        const response = await fetch("/api/returns/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(lookupData.get("email") || "").trim(),
            order_reference: String(lookupData.get("order_reference") || "").trim(),
            requested_resolution: String(requestData.get("resolution") || "refund"),
            reason: String(requestData.get("reason") || "").trim(),
            notes: String(requestData.get("notes") || "").trim(),
            items: [
              {
                order_item_id: selectedItemId,
                quantity: Number(requestData.get("quantity") || 1),
              },
            ],
            photos,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not send request.");

        requestForm.hidden = true;
        setStatus(
          `Return request received. Reference: ${data.return_request.return_reference}`,
          "success"
        );
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  }
})();
