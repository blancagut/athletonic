(function () {
  const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
  const SEARCH_LIMIT = 8;
  const state = {
    suggestions: [],
    highlightedIndex: -1,
    lines: [],
    receipt: null,
    submitting: false,
  };

  const els = {
    searchInput: document.querySelector("[data-search-input]"),
    searchResults: document.querySelector("[data-search-results]"),
    searchStatus: document.querySelector("[data-search-status]"),
    lines: document.querySelector("[data-order-lines]"),
    linesEmpty: document.querySelector("[data-lines-empty]"),
    clearLines: document.querySelector("[data-clear-lines]"),
    form: document.querySelector("[data-order-form]"),
    summaryItems: document.querySelector("[data-summary-items]"),
    summarySubtotal: document.querySelector("[data-summary-subtotal]"),
    summaryTotal: document.querySelector("[data-summary-total]"),
    receiptInput: document.querySelector("[data-receipt-input]"),
    receiptStatus: document.querySelector("[data-receipt-status]"),
    submitButton: document.querySelector("[data-submit-order]"),
    submitStatus: document.querySelector("[data-submit-status]"),
    successBox: document.querySelector("[data-success-box]"),
    successTitle: document.querySelector("[data-success-title]"),
    successCopy: document.querySelector("[data-success-copy]"),
  };

  if (!els.searchInput) return;

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatMoney(cents, currency) {
    if (!Number.isInteger(cents) || cents <= 0) return "Price confirmed after review";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(cents / 100);
  }

  function selectedOptionsLabel(selectedOptions) {
    return Object.entries(selectedOptions || {})
      .map(([name, value]) => `${name}: ${value}`)
      .join(" / ");
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function lineId(product) {
    return `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function productImageHtml(url, alt, className) {
    if (url) {
      return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
    }
    return `<div class="${className}" style="display:flex;align-items:center;justify-content:center;">Athletonic</div>`;
  }

  function setSearchStatus(message) {
    els.searchStatus.textContent = message;
  }

  function setSubmitStatus(message, isError) {
    els.submitStatus.textContent = message;
    els.submitStatus.style.color = isError ? "#b91c1c" : "";
  }

  function setReceiptStatus(message, isError) {
    els.receiptStatus.textContent = message;
    els.receiptStatus.style.color = isError ? "#b91c1c" : "";
  }

  function showSuccess(reference, email) {
    els.successTitle.textContent = "Order submitted.";
    els.successCopy.textContent = `Reference ${reference}. Confirmation sent to ${email}.`;
    els.successBox.setAttribute("data-open", "true");
  }

  function clearSuccess() {
    els.successBox.setAttribute("data-open", "false");
    els.successCopy.textContent = "";
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "Request failed.");
      error.code = data.error || "request_failed";
      throw error;
    }
    return data;
  }

  let searchTimer = null;

  async function runSearch(query) {
    const clean = String(query || "").trim();
    if (!clean) {
      state.suggestions = [];
      state.highlightedIndex = -1;
      renderSearchResults();
      setSearchStatus("Search for your first product.");
      return;
    }

    setSearchStatus(`Searching live catalog for "${clean}"...`);
    const data = await fetchJson(`/api/catalog/search?q=${encodeURIComponent(clean)}&limit=${SEARCH_LIMIT}`);
    state.suggestions = Array.isArray(data.products) ? data.products : [];
    state.highlightedIndex = state.suggestions.length ? 0 : -1;
    renderSearchResults();
    setSearchStatus(
      state.suggestions.length
        ? `${data.total || state.suggestions.length} catalog matches found. Press Enter to add the first one.`
        : "No catalog matches yet. Try a brand, model, SKU, or broader term."
    );
  }

  function scheduleSearch() {
    const query = els.searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      runSearch(query).catch((error) => {
        state.suggestions = [];
        renderSearchResults();
        setSearchStatus(error.message || "Could not search the catalog right now.");
      });
    }, 180);
  }

  function resultMeta(product) {
    const brand = product.brand ? `${product.brand}` : "Athletonic catalog";
    const code = product.model || product.sku || product.id;
    return `${brand}${code ? ` · ${code}` : ""}`;
  }

  function renderSearchResults() {
    const open = state.suggestions.length > 0;
    els.searchResults.setAttribute("data-open", open ? "true" : "false");
    els.searchResults.innerHTML = state.suggestions
      .map((product, index) => {
        return `
          <button class="io-result" type="button" role="option" aria-selected="${index === state.highlightedIndex ? "true" : "false"}" data-result-index="${index}">
            ${productImageHtml(product.image_url || product.image, product.name, "io-result-thumb")}
            <span>
              <span class="io-result-name">${escapeHtml(product.name)}</span>
              <span class="io-result-meta">${escapeHtml(resultMeta(product))}</span>
            </span>
            <span class="io-result-price">${escapeHtml(formatMoney(product.price_cents, product.currency || "USD"))}</span>
          </button>
        `;
      })
      .join("");
  }

  function makeLine(product) {
    const defaultVariant = Array.isArray(product.variant_choices) && product.variant_choices.length
      ? product.variant_choices.find((variant) => variant.available !== false) || product.variant_choices[0]
      : null;
    const defaultColor = Array.isArray(product.color_choices) && product.color_choices.length
      ? product.color_choices.find((choice) => choice.available !== false) || product.color_choices[0]
      : null;
    const colorLabel = defaultColor && defaultColor.label
      ? defaultColor.label
      : (defaultVariant && defaultVariant.color) || product.color_label || "";
    const selectedOptions = { ...(defaultVariant ? defaultVariant.selected_options : {}) };
    if (defaultVariant && defaultVariant.size && !selectedOptions.Size) selectedOptions.Size = defaultVariant.size;
    if (colorLabel && !selectedOptions.Color) selectedOptions.Color = colorLabel;
    const referenceOnly = Boolean(
      colorLabel &&
      product.color_label &&
      slug(colorLabel) !== slug(product.color_label)
    );
    return {
      line_id: lineId(product),
      product_id: product.id,
      product_name: product.name,
      brand: product.brand,
      currency: product.currency || "USD",
      quantity: 1,
      variant_id: defaultVariant ? defaultVariant.variant_id : "",
      color: colorLabel,
      selected_options: selectedOptions,
      variant_choices: product.variant_choices || [],
      color_choices: product.color_choices || [],
      image_url: (defaultVariant && defaultVariant.image_url) || product.image_url || "",
      unit_price_cents: (defaultVariant && defaultVariant.price_cents) || product.price_cents || null,
      product_color_label: product.color_label || "",
      reference_image_only: referenceOnly,
      reference_image_note: referenceOnly && colorLabel ? `Reference image. Selected color: ${colorLabel}.` : "",
    };
  }

  function syncLineFromVariant(line) {
    const variant = line.variant_choices.find((entry) => entry.variant_id === line.variant_id) || line.variant_choices[0];
    if (!variant) return;
    line.variant_id = variant.variant_id;
    line.image_url = variant.image_url || line.image_url;
    line.unit_price_cents = variant.price_cents || line.unit_price_cents;
    line.selected_options = { ...(variant.selected_options || {}) };
    if (variant.size && !line.selected_options.Size) line.selected_options.Size = variant.size;
    if (line.color) line.selected_options.Color = line.color;
    line.reference_image_only = Boolean(
      line.color &&
      line.product_color_label &&
      slug(line.color) !== slug(line.product_color_label)
    );
    line.reference_image_note = line.reference_image_only && line.color
      ? `Reference image. Selected color: ${line.color}.`
      : "";
  }

  async function addProduct(productId) {
    setSearchStatus("Loading product details...");
    const data = await fetchJson(`/api/international-orders?product_id=${encodeURIComponent(productId)}`);
    const line = makeLine(data.product);
    state.lines.push(line);
    els.searchInput.value = "";
    state.suggestions = [];
    state.highlightedIndex = -1;
    renderSearchResults();
    renderLines();
    renderSummary();
    setSearchStatus(`${line.product_name} added to the order.`);
    clearSuccess();
  }

  function renderLines() {
    els.linesEmpty.style.display = state.lines.length ? "none" : "block";
    els.lines.innerHTML = state.lines
      .map((line) => {
        const variantOptions = line.variant_choices
          .map((variant) => {
            const label = variant.size || variant.label || "Variant";
            return `<option value="${escapeHtml(variant.variant_id)}"${variant.variant_id === line.variant_id ? " selected" : ""}>${escapeHtml(label)}</option>`;
          })
          .join("");
        const colorOptions = line.color_choices.length
          ? line.color_choices
              .map((choice) => {
                return `<option value="${escapeHtml(choice.label)}"${choice.label === line.color ? " selected" : ""}>${escapeHtml(choice.label)}</option>`;
              })
              .join("")
          : "";
        const optionsText = selectedOptionsLabel(line.selected_options);
        const lineTotal = Number.isInteger(line.unit_price_cents) ? line.unit_price_cents * Number(line.quantity || 1) : null;
        return `
          <article class="io-card" data-line-id="${escapeHtml(line.line_id)}">
            <div class="io-line">
              ${productImageHtml(line.image_url, line.product_name, "io-line-thumb")}
              <div>
                <div class="io-line-head">
                  <div>
                    <div class="io-line-title">${escapeHtml(line.product_name)}</div>
                    <div class="io-line-meta">${escapeHtml(line.brand)} · ${escapeHtml(optionsText || "Choose the available variant details below.")}</div>
                  </div>
                  <button class="io-remove" type="button" data-remove-line="${escapeHtml(line.line_id)}">Remove</button>
                </div>
                <div class="io-line-actions">
                  <label class="io-field">
                    <span>Quantity</span>
                    <input data-line-quantity="${escapeHtml(line.line_id)}" type="number" min="1" max="999" step="1" value="${escapeHtml(line.quantity)}" />
                  </label>
                  <label class="io-field">
                    <span>Variant</span>
                    <select data-line-variant="${escapeHtml(line.line_id)}">${variantOptions}</select>
                  </label>
                  <label class="io-field">
                    <span>Color</span>
                    ${colorOptions
                      ? `<select data-line-color="${escapeHtml(line.line_id)}">${colorOptions}</select>`
                      : `<input value="${escapeHtml(line.color || "N/A")}" disabled />`}
                  </label>
                  <div class="io-field">
                    <span>Price</span>
                    <div class="io-pill">${escapeHtml(formatMoney(line.unit_price_cents, line.currency))}</div>
                  </div>
                </div>
                <div class="io-line-note">Line total: ${escapeHtml(formatMoney(lineTotal, line.currency))}</div>
                ${line.reference_image_note ? `<div class="io-line-note" style="color:#9a3412;">${escapeHtml(line.reference_image_note)}</div>` : ""}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderSummary() {
    const subtotal = state.lines.reduce((sum, line) => {
      return Number.isInteger(line.unit_price_cents) ? sum + line.unit_price_cents * Number(line.quantity || 1) : sum;
    }, 0);
    const totalLabel = state.lines.length
      ? formatMoney(subtotal, state.lines[0] ? state.lines[0].currency : "USD")
      : "$0.00";
    els.summaryItems.innerHTML = state.lines
      .map((line) => {
        const options = selectedOptionsLabel(line.selected_options);
        return `
          <div class="io-summary-item">
            ${productImageHtml(line.image_url, line.product_name, "io-summary-thumb")}
            <div>
              <div class="io-line-title">${escapeHtml(line.product_name)}</div>
              <div class="io-line-meta">${escapeHtml(line.brand)} · Qty ${escapeHtml(line.quantity)}</div>
              <div class="io-summary-note">${escapeHtml(options || "Variant confirmed in catalog.")}</div>
              ${line.reference_image_note ? `<div class="io-summary-note" style="color:#9a3412;">${escapeHtml(line.reference_image_note)}</div>` : ""}
            </div>
            <strong>${escapeHtml(formatMoney(Number.isInteger(line.unit_price_cents) ? line.unit_price_cents * Number(line.quantity || 1) : null, line.currency))}</strong>
          </div>
        `;
      })
      .join("");
    els.summarySubtotal.textContent = totalLabel;
    els.summaryTotal.textContent = totalLabel;
  }

  function findLine(id) {
    return state.lines.find((line) => line.line_id === id) || null;
  }

  function updateLineVariant(id, variantId) {
    const line = findLine(id);
    if (!line) return;
    line.variant_id = variantId;
    syncLineFromVariant(line);
    renderLines();
    renderSummary();
  }

  function updateLineColor(id, color) {
    const line = findLine(id);
    if (!line) return;
    line.color = color;
    line.selected_options.Color = color;
    const colorChoice = line.color_choices.find((choice) => choice.label === color);
    if (colorChoice && colorChoice.image_url) line.image_url = colorChoice.image_url;
    if (colorChoice && Number.isInteger(colorChoice.price_cents)) line.unit_price_cents = colorChoice.price_cents;
    line.reference_image_only = Boolean(
      line.color &&
      line.product_color_label &&
      slug(line.color) !== slug(line.product_color_label)
    );
    line.reference_image_note = line.reference_image_only ? `Reference image. Selected color: ${line.color}.` : "";
    renderLines();
    renderSummary();
  }

  function updateLineQuantity(id, quantity) {
    const line = findLine(id);
    if (!line) return;
    const nextQty = Number.parseInt(quantity, 10);
    line.quantity = Number.isInteger(nextQty) && nextQty > 0 ? nextQty : 1;
    renderLines();
    renderSummary();
  }

  async function readReceipt(file) {
    if (!file) {
      state.receipt = null;
      setReceiptStatus("No receipt uploaded yet.");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      state.receipt = null;
      els.receiptInput.value = "";
      setReceiptStatus("Receipt must be smaller than 3 MB.", true);
      return;
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected receipt."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
    state.receipt = {
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      data_base64: base64,
    };
    setReceiptStatus(`${file.name} ready to send.`);
  }

  function buildPayload() {
    const fd = new FormData(els.form);
    return {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      country: String(fd.get("country") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      shipping_address: String(fd.get("shipping_address") || "").trim(),
      notes: String(fd.get("notes") || "").trim(),
      receipt: state.receipt,
      items: state.lines.map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id,
        color: line.color,
        quantity: line.quantity,
      })),
    };
  }

  async function submitOrder() {
    if (state.submitting) return;
    clearSuccess();
    if (!state.lines.length) {
      setSubmitStatus("Add at least one product line before submitting.", true);
      return;
    }
    if (!els.form.reportValidity()) {
      setSubmitStatus("Complete the customer details before submitting.", true);
      return;
    }
    state.submitting = true;
    els.submitButton.disabled = true;
    setSubmitStatus("Submitting international order...");
    try {
      const data = await fetchJson("/api/international-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      showSuccess(data.reference, data.customer_email);
      setSubmitStatus("International order sent.");
      els.form.reset();
      els.receiptInput.value = "";
      state.lines = [];
      state.receipt = null;
      renderLines();
      renderSummary();
      setReceiptStatus("No receipt uploaded yet.");
    } catch (error) {
      setSubmitStatus(error.message || "Could not submit the international order.", true);
    } finally {
      state.submitting = false;
      els.submitButton.disabled = false;
    }
  }

  els.searchInput.addEventListener("input", scheduleSearch);

  els.searchInput.addEventListener("keydown", (event) => {
    if (!state.suggestions.length) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.highlightedIndex = (state.highlightedIndex + 1) % state.suggestions.length;
      renderSearchResults();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.highlightedIndex =
        (state.highlightedIndex - 1 + state.suggestions.length) % state.suggestions.length;
      renderSearchResults();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const product = state.suggestions[state.highlightedIndex] || state.suggestions[0];
      if (product) {
        addProduct(product.id).catch((error) => setSearchStatus(error.message || "Could not add the selected product."));
      }
    }
    if (event.key === "Escape") {
      state.suggestions = [];
      state.highlightedIndex = -1;
      renderSearchResults();
    }
  });

  els.searchResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-result-index]");
    if (!button) return;
    const index = Number.parseInt(button.getAttribute("data-result-index"), 10);
    const product = state.suggestions[index];
    if (!product) return;
    addProduct(product.id).catch((error) => setSearchStatus(error.message || "Could not add the selected product."));
  });

  els.lines.addEventListener("input", (event) => {
    const quantityId = event.target.getAttribute("data-line-quantity");
    if (quantityId) updateLineQuantity(quantityId, event.target.value);
  });

  els.lines.addEventListener("change", (event) => {
    const variantId = event.target.getAttribute("data-line-variant");
    const colorId = event.target.getAttribute("data-line-color");
    if (variantId) updateLineVariant(variantId, event.target.value);
    if (colorId) updateLineColor(colorId, event.target.value);
  });

  els.lines.addEventListener("click", (event) => {
    const removeId = event.target.getAttribute("data-remove-line");
    if (!removeId) return;
    state.lines = state.lines.filter((line) => line.line_id !== removeId);
    renderLines();
    renderSummary();
  });

  els.clearLines.addEventListener("click", () => {
    state.lines = [];
    renderLines();
    renderSummary();
    clearSuccess();
  });

  els.receiptInput.addEventListener("change", () => {
    readReceipt(els.receiptInput.files && els.receiptInput.files[0]).catch((error) => {
      state.receipt = null;
      setReceiptStatus(error.message || "Could not read the selected receipt.", true);
    });
  });

  els.submitButton.addEventListener("click", submitOrder);

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-search-root]")) {
      state.suggestions = [];
      state.highlightedIndex = -1;
      renderSearchResults();
    }
  });

  renderLines();
  renderSummary();
})();
