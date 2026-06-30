(function () {
  const API_URL = "/api/wholesale/catalog";
  const QUOTE_API_URL = "/api/wholesale/quote-requests";
  const STORAGE_KEY = "athletonic-wholesale-quote-cart-v1";
  const PAGE_SIZE = 24;

  const els = {
    resultCount: document.querySelector("[data-result-count]"),
    status: document.querySelector("[data-catalog-status]"),
    grid: document.querySelector("[data-product-grid]"),
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
    quoteCount: document.querySelector("[data-quote-count]"),
    quoteStatus: document.querySelector("[data-quote-status]"),
    quoteForm: document.querySelector("[data-quote-form]"),
  };

  const state = {
    filters: {
      search: "",
      brand: "",
      category: "",
      size: "",
      color: "",
      availability: "",
    },
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: false,
    products: [],
    facets: {
      brands: [],
      categories: [],
      sizes: [],
      colors: [],
    },
    quoteCart: loadQuoteCart(),
  };

  function qs(params) {
    const out = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        out.set(key, String(value));
      }
    });
    return out.toString();
  }

  function loadQuoteCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveQuoteCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.quoteCart));
    } catch {
      // ignore storage failures
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

  function currencyLabel(count) {
    return `${count} ${count === 1 ? "item" : "items"}`;
  }

  function setStatus(message) {
    if (els.status) els.status.textContent = message;
  }

  function setQuoteStatus(message, isError = false) {
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

  function updateQuoteBadges() {
    const itemCount = state.quoteCart.length;
    const unitCount = totalUnits();
    if (els.quoteItemCount) els.quoteItemCount.textContent = String(itemCount);
    if (els.quoteUnitCount) els.quoteUnitCount.textContent = String(unitCount);
    if (els.quoteCount) els.quoteCount.textContent = String(itemCount);
    if (els.quoteOpen) {
      els.quoteOpen.dataset.hasItems = itemCount > 0 ? "true" : "false";
    }
  }

  function normalizeOptionValue(value) {
    return String(value || "").trim();
  }

  function addOrUpdateCartItem(product, selectedOptions, quantityDelta = 1) {
    const key = quoteItemKey({ product_id: product.id, selected_options: selectedOptions });
    const existing = state.quoteCart.find(
      (item) => quoteItemKey(item) === key
    );

    if (existing) {
      existing.quantity = Math.max(1, Math.min(999, Number(existing.quantity || 1) + quantityDelta));
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
        selected_options: selectedOptions,
        quantity: Math.max(1, Math.min(999, quantityDelta)),
      });
    }

    saveQuoteCart();
    renderQuoteCart();
    updateQuoteBadges();
    openQuoteDrawer();
    setQuoteStatus("Added to quote cart.");
  }

  function renderQuoteCart() {
    if (!els.quoteItems) return;

    if (!state.quoteCart.length) {
      els.quoteItems.innerHTML = '<p class="wholesale-empty">Your quote cart is empty.</p>';
      updateQuoteBadges();
      return;
    }

    els.quoteItems.innerHTML = state.quoteCart
      .map((item) => {
        const options = Object.entries(item.selected_options || {})
          .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
          .join("");
        return `
          <article class="wholesale-quote-item" data-quote-key="${escapeHtml(quoteItemKey(item))}">
            <img src="${escapeHtml(item.image_url || "")}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" />
            <div class="wholesale-quote-item__body">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.brand)}</span>
              <div class="wholesale-quote-item__meta">${options || `<span>${escapeHtml(item.availability_status || "")}</span>`}</div>
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

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderFacetOptions(selectEl, items, currentValue, placeholder) {
    if (!selectEl) return;
    const options = [`<option value="">${escapeHtml(placeholder)}</option>`]
      .concat(
        items.map((item) =>
          `<option value="${escapeHtml(item.value || item.slug || item)}">${escapeHtml(item.label || item.name || item)}</option>`
        )
      )
      .join("");
    selectEl.innerHTML = options;
    selectEl.value = currentValue || "";
  }

  function updateFacetMenus() {
    renderFacetOptions(
      els.brand,
      state.facets.brands.map((brand) => ({ value: brand.slug, label: brand.name })),
      state.filters.brand,
      "All brands"
    );
    renderFacetOptions(
      els.category,
      state.facets.categories.map((category) => ({ value: category, label: category })),
      state.filters.category,
      "All categories"
    );
    renderFacetOptions(
      els.size,
      state.facets.sizes.map((size) => ({ value: size, label: size })),
      state.filters.size,
      "All sizes"
    );
    renderFacetOptions(
      els.color,
      state.facets.colors.map((color) => ({ value: color, label: color })),
      state.filters.color,
      "All colors"
    );
  }

  function renderEmptyState(message) {
    if (!els.grid) return;
    els.grid.innerHTML = `<div class="wholesale-empty wholesale-empty--grid">${escapeHtml(message)}</div>`;
  }

  function renderProducts(products, append = false) {
    if (!els.grid) return;
    const fragment = document.createDocumentFragment();

    products.forEach((product) => {
      const article = document.createElement("article");
      article.className = "wholesale-card";
      article.dataset.productId = product.id;
      article.innerHTML = `
        <a class="wholesale-card__image" href="${escapeHtml(product.url || "#")}">
          <img src="${escapeHtml(product.image_url || "")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
        </a>
        <div class="wholesale-card__body">
          <div class="wholesale-card__topline">
            <span>${escapeHtml(product.brand)}</span>
            <span class="wholesale-card__status">${escapeHtml(product.availability_status || "")}</span>
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="wholesale-card__category">${escapeHtml(product.category_label || product.product_type || "")}</p>
          <div class="wholesale-card__chips">
            ${Array.isArray(product.sizes) && product.sizes.length ? `<div class="wholesale-chip-group"><span>Sizes</span>${product.sizes.map((size) => `<span class="wholesale-chip">${escapeHtml(size)}</span>`).join("")}</div>` : ""}
            ${Array.isArray(product.colors) && product.colors.length ? `<div class="wholesale-chip-group"><span>Colors</span>${product.colors.map((color) => `<span class="wholesale-chip">${escapeHtml(color)}</span>`).join("")}</div>` : ""}
          </div>
          <div class="wholesale-card__selectors">
            ${
              Array.isArray(product.sizes) && product.sizes.length > 1
                ? `<label><span>Size</span><select data-card-size>${product.sizes
                    .map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`)
                    .join("")}</select></label>`
                : ""
            }
            ${
              Array.isArray(product.colors) && product.colors.length > 1
                ? `<label><span>Color</span><select data-card-color>${product.colors
                    .map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`)
                    .join("")}</select></label>`
                : ""
            }
          </div>
          <button type="button" class="wholesale-card__button" data-add-to-quote>Add to Quote</button>
        </div>
      `;
      fragment.appendChild(article);
    });

    if (!append) {
      els.grid.innerHTML = "";
    }
    els.grid.appendChild(fragment);
  }

  function updateCatalogSummary(filteredCount) {
    if (els.resultCount) {
      els.resultCount.textContent = String(filteredCount);
    }
    const label =
      filteredCount === 0
        ? "No matching products."
        : `${filteredCount} matching products loaded.`;
    setStatus(label);
  }

  function syncFilterStateFromUI() {
    state.filters.search = normalizeOptionValue(els.search && els.search.value);
    state.filters.brand = normalizeOptionValue(els.brand && els.brand.value);
    state.filters.category = normalizeOptionValue(els.category && els.category.value);
    state.filters.size = normalizeOptionValue(els.size && els.size.value);
    state.filters.color = normalizeOptionValue(els.color && els.color.value);
    state.filters.availability = normalizeOptionValue(els.availability && els.availability.value);
  }

  function setLoading(loading) {
    state.loading = loading;
    if (els.loadMore) {
      els.loadMore.disabled = loading;
      els.loadMore.hidden = loading || !state.hasMore;
    }
    if (loading && state.page === 1) {
      setStatus("Loading catalog…");
    }
  }

  async function loadCatalog({ reset = true } = {}) {
    if (state.loading) return;
    syncFilterStateFromUI();
    if (reset) {
      state.page = 1;
      state.products = [];
    }

    setLoading(true);
    try {
      const query = qs({
        ...state.filters,
        page: state.page,
        page_size: state.pageSize,
      });
      const response = await fetch(`${API_URL}?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Catalog request failed (${response.status})`);
      }
      const payload = await response.json();
      state.facets = payload.facets || state.facets;
      state.total = Number(payload.pagination && payload.pagination.total) || 0;
      state.hasMore = Boolean(payload.pagination && payload.pagination.has_more);
      state.products = reset ? payload.products || [] : state.products.concat(payload.products || []);

      if (reset) {
        updateFacetMenus();
        renderProducts(state.products, false);
      } else {
        renderProducts(payload.products || [], true);
      }

      updateCatalogSummary(Number(payload.filtered_count) || state.total);
      if (els.loadMore) {
        els.loadMore.hidden = !state.hasMore;
      }
    } catch (error) {
      setStatus(error.message || "Could not load wholesale catalog.");
      renderEmptyState("Could not load wholesale catalog.");
      if (els.loadMore) els.loadMore.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function cardSelectedOptions(card, product) {
    const selected = {};
    const sizeSelect = card.querySelector("[data-card-size]");
    const colorSelect = card.querySelector("[data-card-color]");

    if (sizeSelect && sizeSelect.value) {
      selected.Size = sizeSelect.value;
    } else if (Array.isArray(product.sizes) && product.sizes.length === 1) {
      selected.Size = product.sizes[0];
    }

    if (colorSelect && colorSelect.value) {
      selected.Color = colorSelect.value;
    } else if (Array.isArray(product.colors) && product.colors.length === 1) {
      selected.Color = product.colors[0];
    }

    return selected;
  }

  function productById(productId) {
    return state.products.find((product) => product.id === productId) || null;
  }

  function handleGridClick(event) {
    const addButton = event.target.closest("[data-add-to-quote]");
    if (!addButton) return;
    const card = addButton.closest("[data-product-id]");
    if (!card) return;
    const product = productById(card.dataset.productId);
    if (!product) return;
    const selectedOptions = cardSelectedOptions(card, product);
    addOrUpdateCartItem(product, selectedOptions, 1);
  }

  function handleQuoteCartClick(event) {
    const itemEl = event.target.closest("[data-quote-key]");
    if (!itemEl) return;
    const key = itemEl.dataset.quoteKey;
    const item = state.quoteCart.find((entry) => quoteItemKey(entry) === key);
    if (!item) return;

    if (event.target.matches("[data-quote-remove]")) {
      state.quoteCart = state.quoteCart.filter((entry) => quoteItemKey(entry) !== key);
      saveQuoteCart();
      renderQuoteCart();
      updateQuoteBadges();
      setQuoteStatus("Removed item from quote cart.");
      return;
    }

    if (event.target.matches("[data-quote-qty]")) {
      const nextValue = Number.parseInt(event.target.value, 10);
      item.quantity = Number.isInteger(nextValue) && nextValue > 0 ? Math.min(999, nextValue) : 1;
      saveQuoteCart();
      renderQuoteCart();
      updateQuoteBadges();
      setQuoteStatus("Updated quantity.");
    }
  }

  function wireQuoteCartQuantityInputs() {
    if (!els.quoteItems) return;
    els.quoteItems.querySelectorAll("[data-quote-qty]").forEach((input) => {
      input.addEventListener("change", handleQuoteCartClick);
    });
  }

  async function submitQuoteRequest(event) {
    event.preventDefault();
    if (!state.quoteCart.length) {
      setQuoteStatus("Add products to the quote cart first.", true);
      return;
    }

    const formData = new FormData(event.currentTarget);
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

    setQuoteStatus("Submitting quote request…");
    const response = await fetch(QUOTE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || "Could not submit quote request.");
    }

    state.quoteCart = [];
    saveQuoteCart();
    renderQuoteCart();
    updateQuoteBadges();
    event.currentTarget.reset();
    setQuoteStatus("Quote request submitted. We will review it and reply soon.");
  }

  function bindFilterEvents() {
    const reload = () => loadCatalog({ reset: true });
    let searchTimer = null;

    if (els.search) {
      els.search.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(reload, 220);
      });
    }
    [els.brand, els.category, els.size, els.color, els.availability].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", reload);
    });
  }

  function bindDrawerEvents() {
    if (els.quoteOpen) {
      els.quoteOpen.addEventListener("click", () => {
        renderQuoteCart();
        openQuoteDrawer();
      });
    }
    if (els.quoteClose) {
      els.quoteClose.addEventListener("click", closeQuoteDrawer);
    }
    if (els.quoteBackdrop) {
      els.quoteBackdrop.addEventListener("click", closeQuoteDrawer);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.quoteDrawer.hidden) {
        closeQuoteDrawer();
      }
    });
  }

  function bindGridEvents() {
    if (els.grid) {
      els.grid.addEventListener("click", handleGridClick);
    }
  }

  function bindQuoteCartEvents() {
    if (els.quoteItems) {
      els.quoteItems.addEventListener("click", handleQuoteCartClick);
    }
    if (els.quoteForm) {
      els.quoteForm.addEventListener("submit", (event) => {
        submitQuoteRequest(event).catch((error) => {
          setQuoteStatus(error.message || "Could not submit quote request.", true);
        });
      });
    }
  }

  function bindLoadMore() {
    if (els.loadMore) {
      els.loadMore.addEventListener("click", async () => {
        if (state.loading || !state.hasMore) return;
        state.page += 1;
        await loadCatalog({ reset: false });
      });
    }
  }

  function hydrateQuoteCart() {
    renderQuoteCart();
    updateQuoteBadges();
  }

  async function boot() {
    bindFilterEvents();
    bindDrawerEvents();
    bindGridEvents();
    bindQuoteCartEvents();
    bindLoadMore();
    hydrateQuoteCart();
    await loadCatalog({ reset: true });
  }

  boot();
})();
