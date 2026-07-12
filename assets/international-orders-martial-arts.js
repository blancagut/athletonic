(function () {
  const PAGE_CONFIG = (typeof window !== "undefined" && window.ATHLETONIC_INTL_CATALOG_CONFIG) || {};
  const API_URL = "/api/wholesale/catalog";
  const QUOTE_API_URL = "/api/wholesale/quote-requests";
  const STORAGE_KEY = String(PAGE_CONFIG.storage_key || "athletonic-international-orders-martial-arts-quote-cart-v1");
  const ALLOWED_BRANDS = Array.isArray(PAGE_CONFIG.brands)
    ? PAGE_CONFIG.brands.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const EXCLUDED_PRODUCT_IDS = Array.isArray(PAGE_CONFIG.excluded_product_ids)
    ? PAGE_CONFIG.excluded_product_ids.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const LIST_NAME = String(PAGE_CONFIG.list || "").trim();
  const SORT_MODE = String(PAGE_CONFIG.sort || "").trim();
  const PAGE_SIZE = 60;
  // Category views load the ENTIRE category in one request so "Shin Guards"
  // really shows every shin guard (API caps page_size at 5000).
  const CATEGORY_PAGE_SIZE = 5000;
  // v2 buying UI (mobile card grid, quick-add sheet, sticky quote bar) is only
  // styled on pages that opt in via the muaythai-mma-body class.
  const UI_V2 = document.body.classList.contains("muaythai-mma-body");
  const mobileMedia = window.matchMedia("(max-width: 700px)");

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
    categoryChips: document.querySelector("[data-category-chips]"),
    brandChips: document.querySelector("[data-brand-chips]"),
    filtersPanel: document.querySelector(".wholesale-filters"),
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
    filters: { search: "", brand: "", category: "", size: "", color: "" },
    facets: { brands: [], categories: [], sizes: [], colors: [] },
    categoryCounts: {},
    lastRenderedCategory: null,
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
    return out.toString().replaceAll("+", "%20");
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

  function priceCellHtml(product) {
    const retail = formatUsd(product.retail_price_cents);
    if (!retail) {
      return '<div class="wholesale-line__price"><span class="wholesale-muted">Quote only</span></div>';
    }
    return `<div class="wholesale-line__price"><strong>${retail}</strong><span>Per unit</span></div>`;
  }

  function estimatedRetailTotalCents() {
    return state.quoteCart.reduce((sum, item) => {
      const unit = Number(item.retail_price_cents);
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
      const totalCents = estimatedRetailTotalCents();
      els.quoteEstimate.textContent = totalCents > 0 ? formatUsd(totalCents) : "\u2014";
    }
    updateQuoteBar();
  }

  function updateQuoteBar() {
    const bar = document.querySelector("[data-quote-bar]");
    if (!bar) return;
    const lineCount = state.quoteCart.length;
    const unitCount = totalUnits();
    const totalCents = estimatedRetailTotalCents();
    bar.hidden = lineCount === 0;
    document.body.classList.toggle("has-quote-bar", lineCount > 0);
    const summary = bar.querySelector("[data-quote-bar-summary]");
    if (summary) {
      const itemsLabel = `${lineCount} ${lineCount === 1 ? "item" : "items"}`;
      const estimate = totalCents > 0 ? ` \u00b7 Est. ${formatUsd(totalCents)}` : "";
      const unitDetail = unitCount !== lineCount ? ` \u00b7 ${unitCount} units` : "";
      summary.textContent = `${itemsLabel}${estimate}${unitDetail}`;
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
    renderCategoryChips();
    renderBrandChips();
  }

  const PREFERRED_BRAND_ORDER = ["twins_special", "topking", "boon"];
  const QUICK_CATEGORY_ALIASES = [
    { value: "Training Gloves", label: "Training Gloves" },
    { value: "Lace-Up & Fight Gloves", label: "Lace-Up Gloves" },
    { value: "Bag Gloves", label: "Bag Gloves" },
    { value: "MMA & Grappling Gloves", label: "MMA Gloves" },
  ];

  function renderBrandChips() {
    if (!els.brandChips) return;
    const brands = (state.facets.brands || []).slice().sort((a, b) => {
      const ai = PREFERRED_BRAND_ORDER.indexOf(String(a.slug || a.value || ""));
      const bi = PREFERRED_BRAND_ORDER.indexOf(String(b.slug || b.value || ""));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    if (!brands.length) {
      els.brandChips.innerHTML = "";
      return;
    }
    const current = state.filters.brand;
    const chips = [{ value: "", label: "All brands" }].concat(
      brands.map((brand) => ({ value: brand.slug || brand.value || "", label: brand.name || brand.label || "" }))
    );
    els.brandChips.innerHTML = chips
      .map(
        (chip) => `
          <button type="button" class="wholesale-chip wholesale-chip--brand" data-chip-brand="${escapeHtml(chip.value)}"
            aria-pressed="${chip.value === current ? "true" : "false"}">${escapeHtml(chip.label)}</button>
        `
      )
      .join("");
  }

  function renderCategoryChips() {
    if (!els.categoryChips) return;
    let categories = state.facets.categories || [];
    if (!categories.length) {
      els.categoryChips.innerHTML = "";
      return;
    }
    // Keep chips in the merchandising order the API sorts products by
    // (gloves first) when category counts are available.
    const countKeys = Object.keys(state.categoryCounts || {});
    if (countKeys.length) {
      const rank = new Map(countKeys.map((key, index) => [key, index]));
      categories = categories
        .slice()
        .sort((a, b) => (rank.has(a) ? rank.get(a) : 99) - (rank.has(b) ? rank.get(b) : 99));
    }
    const current = state.filters.category;
    const quickValues = new Set();
    const quickChips = QUICK_CATEGORY_ALIASES.filter((chip) => categories.includes(chip.value)).map((chip) => {
      quickValues.add(chip.value);
      return {
        value: chip.value,
        label: chip.label,
        count: Number(state.categoryCounts && state.categoryCounts[chip.value]) || null,
        quick: true,
      };
    });
    const categoryChips = categories
      .filter((value) => !quickValues.has(value))
      .map((value) => ({
        value,
        label: value,
        count: Number(state.categoryCounts && state.categoryCounts[value]) || null,
        quick: false,
      }));
    const chips = [{ value: "", label: "All", count: null, quick: false }].concat(quickChips, categoryChips);
    els.categoryChips.innerHTML = chips
      .map(
        (chip) => `
          <button type="button" class="wholesale-chip${chip.quick ? " wholesale-chip--quick" : ""}" data-chip-category="${escapeHtml(
            chip.value
          )}"
            aria-pressed="${chip.value === current ? "true" : "false"}">${escapeHtml(chip.label)}${
              chip.count ? `<span class="wholesale-chip__count">(${chip.count})</span>` : ""
            }</button>
        `
      )
      .join("");
    const active = els.categoryChips.querySelector('[aria-pressed="true"]');
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "center" });
    }
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

  function isBgvl3Product(product) {
    const name = String((product && product.name) || "");
    if (String((product && product.brand_slug) || "") !== "twins_special") return false;
    if (!/boxing gloves/i.test(name)) return false;
    if (!/velcro/i.test(name)) return false;
    if (/laceup|angle color|\bair\b/i.test(name)) return false;
    if (/velcro\s*-\s*\d/i.test(name)) return false;
    return true;
  }

  function colorNoteHtml(product) {
    if (!isBgvl3Product(product)) return "";
    return `
      <label class="wholesale-line__color-note">
        <span>Color choice (optional)</span>
        <input type="text" maxlength="120" placeholder="e.g. Black/Gold" data-card-color-note />
        <small>Many BGVL3 colorways aren't photographed — tell us the exact color combo you want.</small>
      </label>
    `;
  }

  function sectionHeadHtml(label) {
    const count = Number(state.categoryCounts && state.categoryCounts[label]);
    const countHtml = Number.isFinite(count) && count > 0 ? `<span>${count} products</span>` : "";
    return `<div class="wholesale-section-head"><h2>${escapeHtml(label)}</h2>${countHtml}</div>`;
  }

  function renderProducts(products, append) {
    if (!els.list) return;
    if (!append) state.lastRenderedCategory = null;
    const parts = [];
    for (const product of products) {
      const label = String(product.category_label || product.product_type || "").trim();
      if (SORT_MODE === "category" && label && label !== state.lastRenderedCategory) {
        parts.push(sectionHeadHtml(label));
        state.lastRenderedCategory = label;
      }
      parts.push(productLineHtml(product));
    }
    const html = parts.join("");

    if (append) els.list.insertAdjacentHTML("beforeend", html);
    else els.list.innerHTML = html || '<p class="wholesale-empty">No matching products.</p>';
  }

  function productLineHtml(product) {
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
            </div>
            <div class="wholesale-line__options">
              ${optionChips(product.sizes, "Sizes")}
              ${optionChips(product.colors, "Colors")}
              ${!product.sizes.length && !product.colors.length ? '<span class="wholesale-muted">No variants listed</span>' : ""}
              <div class="wholesale-line__selectors">${sizeOptions}${colorOptions}</div>
              ${colorNoteHtml(product)}
            </div>
            ${priceCellHtml(product)}
            <label class="wholesale-line__qty">
              <span>Qty</span>
              <span class="wholesale-qty-stepper">
                <button type="button" data-qty-minus aria-label="Decrease quantity">&minus;</button>
                <input type="number" min="1" max="999" step="1" value="1" data-card-qty inputmode="numeric" />
                <button type="button" data-qty-plus aria-label="Increase quantity">+</button>
              </span>
            </label>
            <button type="button" class="wholesale-line__add" data-add-to-quote>Add to Quote</button>
          </article>
        `;
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
        const retail = formatUsd(item.retail_price_cents);
        const priceLine = retail
          ? `<span class="wholesale-quote-item__price">${retail} <b>/unit</b></span>`
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
      setStatus("Loading catalog...");
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
      const query = params({
        ...state.filters,
        brands: ALLOWED_BRANDS.join(","),
        exclude_ids: EXCLUDED_PRODUCT_IDS.join(","),
        list: LIST_NAME,
        sort: SORT_MODE,
        page: state.page,
        page_size: state.filters.category ? CATEGORY_PAGE_SIZE : state.pageSize,
      });
      const response = await fetch(`${API_URL}?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const payload = await response.json();
      const incoming = Array.isArray(payload.products) ? payload.products : [];

      state.facets = payload.facets || state.facets;
      state.categoryCounts = payload.category_counts || {};
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
    const colorNote = line.querySelector("[data-card-color-note]");
    if (size && size.value) selected.Size = size.value;
    else if (Array.isArray(product.sizes) && product.sizes.length === 1) selected.Size = product.sizes[0];
    if (color && color.value) selected.Color = color.value;
    else if (Array.isArray(product.colors) && product.colors.length === 1) selected.Color = product.colors[0];
    if (colorNote && colorNote.value.trim()) selected["Color note"] = colorNote.value.trim().slice(0, 120);
    return selected;
  }

  function quantityForLine(line) {
    const input = line.querySelector("[data-card-qty]");
    const value = Number.parseInt(input && input.value, 10);
    return Number.isInteger(value) && value > 0 ? Math.min(value, 999) : 1;
  }

  function addOrUpdateCartItem(product, selectedOptions, quantity, options) {
    const opts = options || {};
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
        selected_options: selectedOptions,
        quantity,
      });
    }
    saveQuoteCart();
    renderQuoteCart();
    updateQuoteBadges();
    setQuoteStatus("Added.");
    if (opts.button) flashAddedFeedback(opts.button);
    if (opts.openDrawer !== false && !UI_V2) openQuoteDrawer();
  }

  function flashAddedFeedback(button) {
    if (!button || button.dataset.flashing === "true") return;
    const original = button.textContent;
    button.dataset.flashing = "true";
    button.classList.add("is-added");
    button.textContent = "Added \u2713";
    if (els.quoteOpen) {
      els.quoteOpen.classList.remove("quote-pulse");
      void els.quoteOpen.offsetWidth;
      els.quoteOpen.classList.add("quote-pulse");
    }
    window.setTimeout(() => {
      button.classList.remove("is-added");
      button.textContent = original;
      delete button.dataset.flashing;
    }, 1200);
  }

  function handleLineClick(event) {
    const line = event.target.closest("[data-product-id]");
    if (!line) return;
    const product = productById(line.dataset.productId);
    if (!product) return;

    const stepButton = event.target.closest("[data-qty-minus],[data-qty-plus]");
    if (stepButton) {
      const input = line.querySelector("[data-card-qty]");
      if (input) {
        const current = Number.parseInt(input.value, 10) || 1;
        const next = stepButton.matches("[data-qty-plus]") ? current + 1 : current - 1;
        input.value = String(Math.max(1, Math.min(999, next)));
      }
      return;
    }

    if (event.target.closest("[data-preview-image]")) {
      openImagePreview(product);
      return;
    }

    if (event.target.closest("[data-add-to-quote]")) {
      const button = event.target.closest("[data-add-to-quote]");
      if (UI_V2 && mobileMedia.matches && productNeedsOptions(product)) {
        openQuickAdd(product);
        return;
      }
      addOrUpdateCartItem(product, selectedOptionsForLine(line, product), quantityForLine(line), { button });
    }
  }

  function productNeedsOptions(product) {
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    const colors = Array.isArray(product.colors) ? product.colors : [];
    return sizes.length > 1 || colors.length > 1 || isBgvl3Product(product);
  }

  // ---------------------------------------------------------------------------
  // Mobile quick-add bottom sheet (UI v2): big photo + size/color + qty in the
  // thumb zone, so variant products are easy to configure on a phone.
  // ---------------------------------------------------------------------------
  let quickAddEl = null;

  function ensureQuickAddSheet() {
    if (quickAddEl) return quickAddEl;
    quickAddEl = document.createElement("div");
    quickAddEl.className = "wholesale-quickadd";
    quickAddEl.hidden = true;
    quickAddEl.innerHTML =
      '<div class="wholesale-quickadd__backdrop" data-quickadd-close></div>' +
      '<div class="wholesale-quickadd__sheet" role="dialog" aria-modal="true" aria-label="Add to quote" data-quickadd-body></div>';
    document.body.appendChild(quickAddEl);
    quickAddEl.addEventListener("click", (event) => {
      if (event.target.closest("[data-quickadd-close]")) closeQuickAdd();
    });
    return quickAddEl;
  }

  function openQuickAdd(product) {
    const root = ensureQuickAddSheet();
    const body = root.querySelector("[data-quickadd-body]");
    const sizeOptions = optionSelect(product.sizes, "Size", "data-card-size");
    const colorOptions = optionSelect(product.colors, "Color", "data-card-color");
    const retail = formatUsd(product.retail_price_cents);
    body.innerHTML = `
      <button type="button" class="wholesale-quickadd__close" data-quickadd-close aria-label="Close">&times;</button>
      <div class="wholesale-quickadd__media">
        <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" decoding="async" />
      </div>
      <div class="wholesale-quickadd__info">
        <span class="wholesale-quickadd__brand">${escapeHtml(product.brand)}</span>
        <strong>${escapeHtml(product.name)}</strong>
        ${retail ? `<span class="wholesale-quickadd__price">${retail} <b>/ unit</b></span>` : '<span class="wholesale-quickadd__price wholesale-muted">Price on quote</span>'}
      </div>
      <div class="wholesale-quickadd__selectors">${sizeOptions}${colorOptions}${colorNoteHtml(product)}</div>
      <div class="wholesale-quickadd__footer">
        <span class="wholesale-qty-stepper">
          <button type="button" data-qty-minus aria-label="Decrease quantity">&minus;</button>
          <input type="number" min="1" max="999" step="1" value="1" data-card-qty inputmode="numeric" />
          <button type="button" data-qty-plus aria-label="Increase quantity">+</button>
        </span>
        <button type="button" class="wholesale-quickadd__add" data-quickadd-add>Add to Quote</button>
      </div>
    `;
    body.querySelectorAll("[data-qty-minus],[data-qty-plus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = body.querySelector("[data-card-qty]");
        if (!input) return;
        const current = Number.parseInt(input.value, 10) || 1;
        const next = btn.matches("[data-qty-plus]") ? current + 1 : current - 1;
        input.value = String(Math.max(1, Math.min(999, next)));
      });
    });
    const addButton = body.querySelector("[data-quickadd-add]");
    if (addButton) {
      addButton.addEventListener("click", () => {
        addOrUpdateCartItem(product, selectedOptionsForLine(body, product), quantityForLine(body), {
          openDrawer: false,
        });
        closeQuickAdd();
      });
    }
    root.hidden = false;
    document.body.classList.add("wholesale-drawer-open");
  }

  function closeQuickAdd() {
    if (!quickAddEl) return;
    quickAddEl.hidden = true;
    if ((!els.quoteDrawer || els.quoteDrawer.hidden) && (!els.imageModal || els.imageModal.hidden)) {
      document.body.classList.remove("wholesale-drawer-open");
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
      order_mode: "international_retail",
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
          ? "Submitted. Your quotation is on its way to your email."
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
    [els.brand, els.category, els.size, els.color].forEach((el) => {
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
    if (els.categoryChips) {
      els.categoryChips.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-chip-category]");
        if (!chip) return;
        if (els.category) els.category.value = chip.dataset.chipCategory || "";
        state.filters.category = chip.dataset.chipCategory || "";
        renderCategoryChips();
        loadCatalog({ reset: true });
        scrollToCatalogTop();
      });
    }
    if (els.brandChips) {
      els.brandChips.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-chip-brand]");
        if (!chip) return;
        if (els.brand) els.brand.value = chip.dataset.chipBrand || "";
        state.filters.brand = chip.dataset.chipBrand || "";
        renderBrandChips();
        loadCatalog({ reset: true });
        scrollToCatalogTop();
      });
    }
    if (els.imageModal) {
      els.imageModal.addEventListener("click", (event) => {
        if (event.target === els.imageModal) closeImagePreview();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (quickAddEl && !quickAddEl.hidden) closeQuickAdd();
      else if (els.imageModal && !els.imageModal.hidden) closeImagePreview();
      else if (els.quoteDrawer && !els.quoteDrawer.hidden) closeQuoteDrawer();
    });
  }

  function scrollToCatalogTop() {
    const sheet = document.querySelector(".wholesale-line-sheet");
    if (sheet && typeof sheet.scrollIntoView === "function") {
      sheet.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Auto-load the next page as the shopper approaches the end of the list so
  // categories always feel complete (the button stays as a no-JS fallback).
  function bindInfiniteScroll() {
    if (!els.loadMore || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (state.loading || !state.hasMore) continue;
          state.page += 1;
          loadCatalog({ reset: false });
        }
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(els.loadMore);
  }

  // Sticky quote bar: persistent "review quote" affordance in the thumb zone.
  function injectQuoteBar() {
    if (!UI_V2 || document.querySelector("[data-quote-bar]")) return;
    const bar = document.createElement("div");
    bar.className = "wholesale-quote-bar";
    bar.hidden = true;
    bar.setAttribute("data-quote-bar", "");
    bar.innerHTML =
      '<span data-quote-bar-summary></span>' +
      '<button type="button" data-quote-bar-open>Review quote &rarr;</button>';
    document.body.appendChild(bar);
    const open = bar.querySelector("[data-quote-bar-open]");
    if (open) open.addEventListener("click", openQuoteDrawer);
  }

  function boot() {
    bindEvents();
    bindInfiniteScroll();
    injectQuoteBar();
    renderQuoteCart();
    updateQuoteBadges();
    loadCatalog({ reset: true });
  }

  boot();
})();
