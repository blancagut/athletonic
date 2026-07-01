(function () {
  const API_URL = "/api/wholesale/catalog";
  const QUOTE_API_URL = "/api/wholesale/quote-requests";
  const STORAGE_KEY = "athletonic-wholesale-quote-cart-v2";
  const PAGE_SIZE = 60;

  const els = {
    resultCount: document.querySelector("[data-result-count]"),
    status: document.querySelector("[data-catalog-status]"),
    list: document.querySelector("[data-product-grid]"),
    loadMore: document.querySelector("[data-load-more]"),
    search: document.querySelector("[data-filter-search]"),
    brand: document.querySelector("[data-filter-brand]"),
    category: document.querySelector("[data-filter-category]"),
    size: document.querySelector("[data-filter-size]"),
    color: document.querySelector("[data-filter-color]"),
    availability: document.querySelector("[data-filter-availability]"),
    quoteOpen: document.querySelector("[data-quote-open]"),
    quoteClose: document.querySelector("[data-quote-close]"),
    quoteDrawer: document.querySelector("[data-quote-drawer]"),
    quoteBackdrop: document.querySelector("[data-quote-backdrop]"),
    quoteItems: document.querySelector("[data-quote-items]"),
    quoteItemCount: document.querySelector("[data-quote-item-count]"),
    quoteUnitCount: document.querySelector("[data-quote-unit-count]"),
    quoteEstimate: document.querySelector("[data-quote-estimate]"),
    quoteCount: document.querySelector("[data-quote-count]"),
    quoteStatus: document.querySelector("[data-quote-status]"),
    quoteForm: document.querySelector("[data-quote-form]"),
    imageModal: document.querySelector("[data-image-modal]"),
    imagePreview: document.querySelector("[data-image-preview]"),
    imageClose: document.querySelector("[data-image-close]"),
  };

  const state = {
    filters: { search: "", brand: "", category: "", size: "", color: "", availability: "" },
    facets: { brands: [], categories: [], sizes: [], colors: [] },
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: false,
    products: [],
    quoteCart: loadQuoteCart(),
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function params(values) {
    const out = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (String(value || "").trim()) out.set(key, String(value).trim());
    });
    return out.toString();
  }

  function loadQuoteCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveQuoteCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.quoteCart));
    } catch {
      // Storage can fail in private browsing; the current page state still works.
    }
  }

  function selectedOptionsKey(selectedOptions) {
    return Object.keys(selectedOptions || {})
      .sort()
      .map((key) => `${key}:${selectedOptions[key]}`)
      .join("|");
  }

  function quoteItemKey(item) {
    return `${item.product_id}::${selectedOptionsKey(item.selected_options || {})}`;
  }

  function totalUnits() {
    return state.quoteCart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  function formatUsd(cents) {
    const value = Number(cents);
    if (!Number.isFinite(value) || value <= 0) return "";
    return (value / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function discountLabel(bps) {
    const value = Number(bps);
    if (!Number.isFinite(value) || value <= 0) return "";
    return `${Math.round(value / 100)}% off`;
  }

  function priceCellHtml(product) {
    const retail = formatUsd(product.retail_price_cents);
    const wholesale = formatUsd(product.wholesale_price_cents);
    if (!retail || !wholesale) {
      return '<div class="wholesale-line__price"><span class="wholesale-muted">Quote only</span></div>';
    }
    return `
      <div class="wholesale-line__price">
        <strong>${retail}</strong>
        <span>Wholesale <b>${wholesale}</b></span>
      </div>
    `;
  }

  function estimatedWholesaleTotalCents() {
    return state.quoteCart.reduce((sum, item) => {
      const unit = Number(item.wholesale_price_cents);
      if (!Number.isFinite(unit) || unit <= 0) return sum;
      return sum + unit * Number(item.quantity || 0);
    }, 0);
  }

  function setStatus(message) {
    if (els.status) els.status.textContent = message;
  }

  function setQuoteStatus(message, isError) {
    if (!els.quoteStatus) return;
    els.quoteStatus.textContent = message || "";
    els.quoteStatus.dataset.error = isError ? "true" : "false";
  }

  function openQuoteDrawer() {
    if (!els.quoteDrawer || !els.quoteBackdrop) return;
    els.quoteDrawer.hidden = false;
    els.quoteBackdrop.hidden = false;
    document.body.classList.add("wholesale-drawer-open");
    if (els.quoteOpen) els.quoteOpen.setAttribute("aria-expanded", "true");
  }

  function closeQuoteDrawer() {
    if (!els.quoteDrawer || !els.quoteBackdrop) return;
    els.quoteDrawer.hidden = true;
    els.quoteBackdrop.hidden = true;
    document.body.classList.remove("wholesale-drawer-open");
    if (els.quoteOpen) els.quoteOpen.setAttribute("aria-expanded", "false");
  }

  function openImagePreview(product) {
    if (!els.imageModal || !els.imagePreview || !product.image_url) return;
    els.imagePreview.src = product.image_url;
    els.imagePreview.alt = product.name || "Product image";
    els.imageModal.hidden = false;
    document.body.classList.add("wholesale-drawer-open");
  }

  function closeImagePreview() {
    if (!els.imageModal || !els.imagePreview) return;
    els.imageModal.hidden = true;
    els.imagePreview.removeAttribute("src");
    if (!els.quoteDrawer || els.quoteDrawer.hidden) document.body.classList.remove("wholesale-drawer-open");
  }

  function updateQuoteBadges() {
    const lineCount = state.quoteCart.length;
    const unitCount = totalUnits();
    if (els.quoteItemCount) els.quoteItemCount.textContent = String(lineCount);
    if (els.quoteUnitCount) els.quoteUnitCount.textContent = String(unitCount);
    if (els.quoteCount) els.quoteCount.textContent = String(lineCount);
    if (els.quoteOpen) els.quoteOpen.dataset.hasItems = lineCount > 0 ? "true" : "false";
    if (els.quoteEstimate) {
      const totalCents = estimatedWholesaleTotalCents();
      els.quoteEstimate.textContent = totalCents > 0 ? formatUsd(totalCents) : "\u2014";
    }
  }

  function renderSelect(selectEl, items, currentValue, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = [`<option value="">${escapeHtml(placeholder)}</option>`]
      .concat(
        items.map((item) => {
          const value = item.value || item.slug || item;
          const label = item.label || item.name || item;
          return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
        })
      )
      .join("");
    selectEl.value = currentValue || "";
  }

  function updateFacetMenus() {
    renderSelect(els.brand, state.facets.brands, state.filters.brand, "All brands");
    renderSelect(
      els.category,
      (state.facets.categories || []).map((value) => ({ value, label: value })),
      state.filters.category,
      "All categories"
    );
    renderSelect(
      els.size,
      (state.facets.sizes || []).map((value) => ({ value, label: value })),
      state.filters.size,
      "All sizes"
    );
    renderSelect(
      els.color,
      (state.facets.colors || []).map((value) => ({ value, label: value })),
      state.filters.color,
      "All colors"
    );
  }

  function optionChips(values, label) {
    if (!Array.isArray(values) || !values.length) return "";
    const visible = values.slice(0, 5);
    const rest = values.length - visible.length;
    return `
      <div class="wholesale-option-line">
        <span>${escapeHtml(label)}</span>
        ${visible.map((value) => `<b>${escapeHtml(value)}</b>`).join("")}
        ${rest > 0 ? `<b>+${rest}</b>` : ""}
      </div>
    `;
  }

  function optionSelect(values, name, attr) {
    if (!Array.isArray(values) || values.length < 2) return "";
    return `
      <label>
        <span>${escapeHtml(name)}</span>
        <select ${attr}>
          ${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function renderProducts(products, append) {
    if (!els.list) return;
    const html = products
      .map((product) => {
        const sizeOptions = optionSelect(product.sizes, "Size", "data-card-size");
        const colorOptions = optionSelect(product.colors, "Color", "data-card-color");
        return `
          <article class="wholesale-line" data-product-id="${escapeHtml(product.id)}">
            <button type="button" class="wholesale-line__photo" data-preview-image aria-label="View image for ${escapeHtml(product.name)}">
              <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
            </button>
            <div class="wholesale-line__product">
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.id)}</span>
            </div>
            <div class="wholesale-line__brand">${escapeHtml(product.brand)}</div>
            <div class="wholesale-line__type">
              <b>${escapeHtml(product.category_label || product.product_type)}</b>
              <span>${escapeHtml(product.availability_status || "")}</span>
            </div>
            <div class="wholesale-line__options">
              ${optionChips(product.sizes, "Sizes")}
              ${optionChips(product.colors, "Colors")}
              ${!product.sizes.length && !product.colors.length ? '<span class="wholesale-muted">No variants listed</span>' : ""}
              <div class="wholesale-line__selectors">${sizeOptions}${colorOptions}</div>
            </div>
            ${priceCellHtml(product)}
            <label class="wholesale-line__qty">
              <span>Qty</span>
              <input type="number" min="1" max="999" step="1" value="1" data-card-qty />
            </label>
            <button type="button" class="wholesale-line__add" data-add-to-quote>Add to Quote</button>
          </article>
        `;
      })
      .join("");

    if (append) els.list.insertAdjacentHTML("beforeend", html);
    else els.list.innerHTML = html || '<p class="wholesale-empty">No matching products.</p>';
  }

  function renderQuoteCart() {
    if (!els.quoteItems) return;
    if (!state.quoteCart.length) {
      els.quoteItems.innerHTML = '<p class="wholesale-empty">No products selected.</p>';
      updateQuoteBadges();
      return;
    }

    els.quoteItems.innerHTML = state.quoteCart
      .map((item) => {
        const options = Object.entries(item.selected_options || {})
          .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
          .join("");
        const wholesale = formatUsd(item.wholesale_price_cents);
        const priceLine = wholesale
          ? `<span class="wholesale-quote-item__price">Wholesale <b>${wholesale}</b>/unit</span>`
          : '<span class="wholesale-quote-item__price wholesale-muted">Price on quote</span>';
        return `
          <article class="wholesale-quote-item" data-quote-key="${escapeHtml(quoteItemKey(item))}">
            <img src="${escapeHtml(item.image_url || "")}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />
            <div class="wholesale-quote-item__body">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.brand)}</span>
              ${priceLine}
              <div class="wholesale-quote-item__meta">${options || `<span>${escapeHtml(item.category_label || "")}</span>`}</div>
              <div class="wholesale-quote-item__controls">
                <label>
                  <span>Qty</span>
                  <input type="number" min="1" max="999" step="1" value="${String(item.quantity || 1)}" data-quote-qty />
                </label>
                <button type="button" class="wholesale-link-button" data-quote-remove>Remove</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
    updateQuoteBadges();
  }

  function syncFilters() {
    state.filters.search = String((els.search && els.search.value) || "").trim();
    state.filters.brand = String((els.brand && els.brand.value) || "").trim();
    state.filters.category = String((els.category && els.category.value) || "").trim();
    state.filters.size = String((els.size && els.size.value) || "").trim();
    state.filters.color = String((els.color && els.color.value) || "").trim();
    state.filters.availability = String((els.availability && els.availability.value) || "").trim();
  }

  function skeletonRows(count) {
    const cells =
      '<span class="ws-skel ws-skel--photo"></span><span class="ws-skel ws-skel--text"></span>' +
      '<span class="ws-skel ws-skel--chip"></span><span class="ws-skel ws-skel--chip"></span>' +
      '<span class="ws-skel ws-skel--text"></span><span class="ws-skel ws-skel--chip"></span>' +
      '<span class="ws-skel ws-skel--chip"></span><span class="ws-skel ws-skel--chip"></span>';
    return Array.from(
      { length: count },
      () => `<div class="wholesale-line wholesale-line--skeleton" aria-hidden="true">${cells}</div>`
    ).join("");
  }

  function setLoading(loading) {
    state.loading = loading;
    if (els.loadMore) {
      els.loadMore.disabled = loading;
      els.loadMore.hidden = loading || !state.hasMore;
    }
    if (loading && state.page === 1) {
      setStatus("Loading line sheet...");
      if (els.list) els.list.innerHTML = skeletonRows(8);
    }
  }

  async function loadCatalog(options) {
    if (state.loading) return;
    const reset = !options || options.reset !== false;
    syncFilters();
    if (reset) {
      state.page = 1;
      state.products = [];
    }

    setLoading(true);
    try {
      const query = params({ ...state.filters, page: state.page, page_size: state.pageSize });
      const response = await fetch(`${API_URL}?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const payload = await response.json();
      const incoming = Array.isArray(payload.products) ? payload.products : [];

      state.facets = payload.facets || state.facets;
      state.total = Number(payload.filtered_count || (payload.pagination && payload.pagination.total) || 0);
      state.hasMore = Boolean(payload.pagination && payload.pagination.has_more);
      state.products = reset ? incoming : state.products.concat(incoming);

      if (reset) updateFacetMenus();
      renderProducts(incoming, !reset);
      if (els.resultCount) els.resultCount.textContent = String(state.total);
      setStatus(`${state.total} catalog lines`);
      if (els.loadMore) els.loadMore.hidden = !state.hasMore;
    } catch (error) {
      if (els.list) els.list.innerHTML = '<p class="wholesale-empty">Could not load catalog.</p>';
      setStatus(error.message || "Could not load catalog.");
      if (els.loadMore) els.loadMore.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function productById(productId) {
    return state.products.find((product) => product.id === productId) || null;
  }

  function selectedOptionsForLine(line, product) {
    const selected = {};
    const size = line.querySelector("[data-card-size]");
    const color = line.querySelector("[data-card-color]");
    if (size && size.value) selected.Size = size.value;
    else if (Array.isArray(product.sizes) && product.sizes.length === 1) selected.Size = product.sizes[0];
    if (color && color.value) selected.Color = color.value;
    else if (Array.isArray(product.colors) && product.colors.length === 1) selected.Color = product.colors[0];
    return selected;
  }

  function quantityForLine(line) {
    const input = line.querySelector("[data-card-qty]");
    const value = Number.parseInt(input && input.value, 10);
    return Number.isInteger(value) && value > 0 ? Math.min(value, 999) : 1;
  }

  function addOrUpdateCartItem(product, selectedOptions, quantity) {
    const draft = { product_id: product.id, selected_options: selectedOptions };
    const key = quoteItemKey(draft);
    const existing = state.quoteCart.find((item) => quoteItemKey(item) === key);
    if (existing) {
      existing.quantity = Math.max(1, Math.min(999, Number(existing.quantity || 1) + quantity));
    } else {
      state.quoteCart.push({
        product_id: product.id,
        brand: product.brand,
        name: product.name,
        category_label: product.category_label,
        product_type: product.product_type,
        image_url: product.image_url,
        url: product.url,
        availability_status: product.availability_status,
        retail_price_cents: product.retail_price_cents || null,
        wholesale_price_cents: product.wholesale_price_cents || null,
        selected_options: selectedOptions,
        quantity,
      });
    }
    saveQuoteCart();
    renderQuoteCart();
    updateQuoteBadges();
    openQuoteDrawer();
    setQuoteStatus("Added.");
  }

  function handleLineClick(event) {
    const line = event.target.closest("[data-product-id]");
    if (!line) return;
    const product = productById(line.dataset.productId);
    if (!product) return;

    if (event.target.closest("[data-preview-image]")) {
      openImagePreview(product);
      return;
    }

    if (event.target.closest("[data-add-to-quote]")) {
      addOrUpdateCartItem(product, selectedOptionsForLine(line, product), quantityForLine(line));
    }
  }

  function handleQuoteCartInput(event) {
    const itemEl = event.target.closest("[data-quote-key]");
    if (!itemEl || !event.target.matches("[data-quote-qty]")) return;
    const key = itemEl.dataset.quoteKey;
    const item = state.quoteCart.find((entry) => quoteItemKey(entry) === key);
    if (!item) return;
    const nextValue = Number.parseInt(event.target.value, 10);
    item.quantity = Number.isInteger(nextValue) && nextValue > 0 ? Math.min(999, nextValue) : 1;
    saveQuoteCart();
    updateQuoteBadges();
  }

  function handleQuoteCartClick(event) {
    const itemEl = event.target.closest("[data-quote-key]");
    if (!itemEl || !event.target.matches("[data-quote-remove]")) return;
    const key = itemEl.dataset.quoteKey;
    state.quoteCart = state.quoteCart.filter((entry) => quoteItemKey(entry) !== key);
    saveQuoteCart();
    renderQuoteCart();
    updateQuoteBadges();
    setQuoteStatus("Removed.");
  }

  async function submitQuoteRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!state.quoteCart.length) {
      setQuoteStatus("Add products first.", true);
      return;
    }

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      company_name: String(formData.get("company_name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      whatsapp: String(formData.get("whatsapp") || "").trim(),
      country: String(formData.get("country") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      items: state.quoteCart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_options: item.selected_options || {},
      })),
      source_page: window.location.pathname,
    };

    const submitButton = form.querySelector("[type=submit]");
    if (submitButton) submitButton.disabled = true;
    setQuoteStatus("Submitting...");
    try {
      const response = await fetch(QUOTE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Could not submit quote request.");

      state.quoteCart = [];
      saveQuoteCart();
      renderQuoteCart();
      updateQuoteBadges();
      form.reset();
      setQuoteStatus(
        body.buyer_confirmation_sent
          ? "Submitted. Your PDF quotation is on its way to your email."
          : "Submitted. Our team will reply with your quotation shortly."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function bindEvents() {
    let searchTimer = null;
    const reload = () => loadCatalog({ reset: true });
    if (els.search) {
      els.search.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(reload, 180);
      });
    }
    [els.brand, els.category, els.size, els.color, els.availability].forEach((el) => {
      if (el) el.addEventListener("change", reload);
    });
    if (els.loadMore) {
      els.loadMore.addEventListener("click", () => {
        if (state.loading || !state.hasMore) return;
        state.page += 1;
        loadCatalog({ reset: false });
      });
    }
    if (els.list) els.list.addEventListener("click", handleLineClick);
    if (els.quoteOpen) els.quoteOpen.addEventListener("click", openQuoteDrawer);
    if (els.quoteClose) els.quoteClose.addEventListener("click", closeQuoteDrawer);
    if (els.quoteBackdrop) els.quoteBackdrop.addEventListener("click", closeQuoteDrawer);
    if (els.quoteItems) {
      els.quoteItems.addEventListener("click", handleQuoteCartClick);
      els.quoteItems.addEventListener("change", handleQuoteCartInput);
      els.quoteItems.addEventListener("input", handleQuoteCartInput);
    }
    if (els.quoteForm) {
      els.quoteForm.addEventListener("submit", (event) => {
        submitQuoteRequest(event).catch((error) => setQuoteStatus(error.message, true));
      });
    }
    if (els.imageClose) els.imageClose.addEventListener("click", closeImagePreview);
    if (els.imageModal) {
      els.imageModal.addEventListener("click", (event) => {
        if (event.target === els.imageModal) closeImagePreview();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (els.imageModal && !els.imageModal.hidden) closeImagePreview();
      else if (els.quoteDrawer && !els.quoteDrawer.hidden) closeQuoteDrawer();
    });
  }

  function boot() {
    bindEvents();
    renderQuoteCart();
    updateQuoteBadges();
    loadCatalog({ reset: true });
  }

  boot();
})();
