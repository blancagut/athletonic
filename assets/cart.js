/*
 * Shared client runtime for Athletonic.
 *
 * Used by both the home page (index.html) and product detail pages
 * (product/{id}.html). All DOM lookups are null-guarded so pieces that
 * only exist on one page (search form, hero, etc.) are skipped silently
 * on pages where they are absent.
 */
(function () {
  const SUPABASE_PUBLIC_URL = window.ATHLETONIC_SUPABASE_URL;
  const SUPABASE_PUBLIC_KEY = window.ATHLETONIC_SUPABASE_KEY;
  const CART_STORAGE_KEY = "athletonic-cart-v1";
  const GUEST_EMAIL_KEY = "athletonic-guest-email";
  const LAST_ORDER_REFERENCE_KEY = "athletonic-last-order-reference";
  const LAST_TRANSFER_ORDER_KEY = "athletonic-last-transfer-order";
  const LEGACY_PRODUCT_ID_ALIASES = {
    "1509-extreme": "1509",
    "1509-other": "1509",
    "1509-vanilla": "1509",
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector));

  function pagePathPrefix() {
    return /\/(pages|product)\//.test(window.location.pathname) ? "../" : "./";
  }

  function publicProductSlug(id) {
    return normalizeProductId(id)
      .replace(/^official-/, "")
      .replace(/^(raja|twins|fairtex|boon|topking|primo|yokkao)-\1-/, "$1-");
  }

  function primaryProductHref(product) {
    const id = normalizeProductId(product && product.id);
    const pdpHref = pagePathPrefix() + "product/" + encodeURIComponent(publicProductSlug(id));
    // External product URLs are source/reference data. They become the primary
    // click destination only for an explicitly external-only record.
    if (product && product.external_only === true && product.has_pdp === false && product.url) {
      return product.url;
    }
    return pdpHref;
  }

  function ensureMobileBottomNav() {
    const existingNav = document.querySelector(".mobile-bottom-nav");
    if (existingNav) {
      if (!existingNav.querySelector("[data-account-open]")) {
        const legacyDeals = Array.from(existingNav.children).find((item) =>
          /deals/i.test(item.textContent || "")
        );
        const accountButton = document.createElement("button");
        accountButton.type = "button";
        accountButton.setAttribute("data-account-open", "");
        accountButton.setAttribute("aria-haspopup", "dialog");
        accountButton.setAttribute("aria-controls", "account-panel");
        accountButton.setAttribute("aria-expanded", "false");
        accountButton.setAttribute("aria-label", "Open account panel");
        accountButton.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="10"></circle>' +
            '<circle cx="12" cy="10" r="3"></circle>' +
            '<path d="M7 20.4a5.5 5.5 0 0 1 10 0"></path>' +
          '</svg><span>Account</span>';
        if (legacyDeals) legacyDeals.replaceWith(accountButton);
        else existingNav.insertBefore(accountButton, existingNav.lastElementChild);
      }
      return;
    }
    if (/\/pages\/admin\//.test(window.location.pathname)) return;

    const pathPrefix = pagePathPrefix();
    const nav = document.createElement("nav");
    nav.className = "mobile-bottom-nav";
    nav.setAttribute("aria-label", "Mobile store navigation");
    nav.innerHTML =
      '<a href="' + pathPrefix + '" aria-label="Home">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="m3 11 9-8 9 8"></path>' +
          '<path d="M5 10v10h14V10"></path>' +
          '<path d="M9 20v-6h6v6"></path>' +
        '</svg>' +
        '<span>Home</span>' +
      '</a>' +
      '<a href="#department-nav" data-mobile-categories aria-label="Categories">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M4 6h16"></path>' +
          '<path d="M4 12h16"></path>' +
          '<path d="M4 18h16"></path>' +
        '</svg>' +
        '<span>Categories</span>' +
      '</a>' +
      '<button type="button" data-account-open aria-haspopup="dialog" aria-controls="account-panel" aria-expanded="false" aria-label="Open account panel">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10"></circle>' +
          '<circle cx="12" cy="10" r="3"></circle>' +
          '<path d="M7 20.4a5.5 5.5 0 0 1 10 0"></path>' +
        '</svg>' +
        '<span>Account</span>' +
      '</button>' +
      '<button type="button" data-cart-open aria-haspopup="dialog" aria-controls="cart-drawer" aria-expanded="false" aria-label="Open cart">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="8" cy="21" r="1"></circle>' +
          '<circle cx="19" cy="21" r="1"></circle>' +
          '<path d="M2.05 2.05h2l2.65 12.4a2 2 0 0 0 2 1.6h8.95a2 2 0 0 0 1.95-1.57l1.25-5.48H5.45"></path>' +
        '</svg>' +
        '<span>Cart</span>' +
        '<span class="mobile-bottom-count" data-cart-count hidden>0</span>' +
      '</button>';
    document.body.appendChild(nav);
  }

  function mobileCategoryLinks(source) {
    const linkMarkup = (link) => {
      const href = link.getAttribute("href");
      const separator = href.indexOf("?") === -1 ? "?" : "&";
      return '<a href="' + href + separator + 'mobile-categories=8">' + link.textContent.trim() + "</a>";
    };
    return Array.from(source.children).map((item) => {
      if (item.matches("a")) return linkMarkup(item);
      if (!item.matches("details")) return "";
      const summary = item.querySelector("summary");
      const links = Array.from(item.querySelectorAll(".department-submenu-panel a"));
      return '<details class="mobile-category-group"><summary>' +
        (summary ? summary.textContent.trim() : "Combat Gear") +
        '</summary><div class="mobile-category-group-links">' +
        links.map(linkMarkup).join("") +
        "</div></details>";
    }).join("");
  }

  function ensureMobileCategoriesPanel() {
    const source = document.querySelector("[data-department-nav]");
    if (document.querySelector("[data-mobile-categories-panel]")) return;

    const panel = document.createElement("aside");
    panel.className = "mobile-categories-panel";
    panel.setAttribute("data-mobile-categories-panel", "");
    panel.setAttribute("aria-label", "Categories");
    panel.hidden = true;
    panel.innerHTML =
        '<div class="mobile-categories-backdrop" data-mobile-categories-close></div>' +
        '<section class="mobile-categories-sheet" role="dialog" aria-modal="true" aria-label="Categories">' +
        '<div class="mobile-categories-heading"><div class="mobile-categories-title"><img src="' + pagePathPrefix() + 'assets/logo.png" alt="" width="44" height="44"><strong>Categories</strong></div><button type="button" data-mobile-categories-close aria-label="Close categories">×</button></div>' +
        '<a class="mobile-categories-home" href="' + pagePathPrefix() + '"><span aria-hidden="true">⌂</span>Home</a>' +
        '<nav class="mobile-categories-links"></nav>' +
      "</section>";
    document.body.appendChild(panel);

    if (source) {
      $(".mobile-categories-links", panel).innerHTML = mobileCategoryLinks(source);
    }

    const close = () => {
      panel.hidden = true;
      document.documentElement.classList.remove("mobile-menu-open");
      const trigger = $("[data-mobile-categories]");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      document.querySelectorAll(".department-submenu > summary[aria-expanded]").forEach((summary) => {
        summary.setAttribute("aria-expanded", "false");
      });
    };
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-mobile-categories-close], .mobile-categories-links a")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function showMobileCategories(trigger, expandedGroupLabel) {
    ensureMobileCategoriesPanel();
    const panel = $("[data-mobile-categories-panel]");
    if (!panel) return;
    const source = $("[data-department-nav]");
    const links = $(".mobile-categories-links", panel);
    if (source && links && !links.children.length) {
      links.innerHTML = mobileCategoryLinks(source);
    }
    panel.hidden = false;
    document.documentElement.classList.add("mobile-menu-open");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (expandedGroupLabel && links) {
      const target = Array.from(links.querySelectorAll(".mobile-category-group")).find((group) =>
        group.querySelector("summary")?.textContent.trim() === expandedGroupLabel.trim()
      );
      if (target) {
        target.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      }
    }
  }

  function normalizeLegacyCatalogLinks() {
    const catalogHref = pagePathPrefix() + "pages/catalog.html";
    document.querySelectorAll('a[href="../#"], a[href="./#"]').forEach((link) => {
      if (link.textContent.trim().toLowerCase() === "athletonic catalog") {
        link.setAttribute("href", catalogHref);
      }
    });
  }

  ensureMobileBottomNav();
  ensureMobileCategoriesPanel();
  normalizeLegacyCatalogLinks();

  function ensureCartDrawerShell() {
    if ($("[data-cart-drawer]") && $("[data-drawer-overlay]")) return;

    const overlay = document.createElement("div");
    overlay.className = "drawer-overlay";
    overlay.dataset.drawerOverlay = "";
    overlay.hidden = true;

    const drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.id = "cart-drawer";
    drawer.dataset.cartDrawer = "";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-labelledby", "cart-title");
    drawer.innerHTML =
      '<div class="drawer-header"><h2 id="cart-title">Your cart</h2>' +
      '<button class="drawer-close" type="button" data-cart-close aria-label="Close cart">&times;</button></div>' +
      '<div class="cart-items" data-cart-items></div>' +
      '<form class="checkout-form" data-checkout-form>' +
      '<label for="checkout-email">Email</label>' +
      '<input id="checkout-email" name="email" type="email" autocomplete="email" required>' +
      '<p data-checkout-status aria-live="polite"></p>' +
      '<div class="cart-total"><span>Subtotal</span><strong data-cart-subtotal>—</strong></div>' +
      '<button type="submit" data-checkout-submit>Buy Now</button></form>';

    document.body.append(overlay, drawer);
  }

  ensureCartDrawerShell();

  window.addEventListener("pageshow", () => {
    const categoriesPanel = $("[data-mobile-categories-panel]");
    if (categoriesPanel) categoriesPanel.hidden = true;
    document.documentElement.classList.remove("mobile-menu-open");
    const categoriesLink = $("[data-mobile-categories]");
    if (categoriesLink) categoriesLink.setAttribute("aria-expanded", "false");
  });

  const searchForm = $("[data-catalog-search]");
  const searchStatus = $(".search-status");
  const productCards = $$(".product-card");
  const drawerOverlay = $("[data-drawer-overlay]");
  const cartDrawer = $("[data-cart-drawer]");
  const accountPanel = $("[data-account-panel]");
  const cartItems = $("[data-cart-items]");
  const cartCounts = $$("[data-cart-count]");
  const cartSubtotal = $("[data-cart-subtotal]");
  const checkoutForm = $("[data-checkout-form]");
  const checkoutEmail = $("#checkout-email");
  const checkoutStatus = $("[data-checkout-status]");
  const checkoutSubmit = $("[data-checkout-submit]");
  const accountForm = $("[data-account-form]");
  const accountEmail = $("#guest-email");
  const accountStatus = $("[data-account-status]");
  const accountLabel = $("[data-account-label]");
  const cartOpenButtons = $$("[data-cart-open]");
  const accountOpenButtons = $$("[data-account-open]");

  let cart = loadCart();
  // Persist normalized legacy arrays with a display price while server validation loads.
  saveCart();
  let cartValidation = {
    status: cart.length ? "loading" : "empty",
    valid: false,
    signature: "",
    code: cart.length ? "" : "empty_cart",
    message: cart.length ? "" : "Add at least one product before checkout.",
    subtotalCents: Math.round(cartTotal() * 100),
    currency: cart[0] ? cart[0].currency || "USD" : "USD",
    items: [],
    lineItems: [],
    invalidItems: [],
    error: "",
  };
  let checkoutBusy = false;
  let lastDrawerTrigger = null;

  function storageGet(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function escapeMarkup(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[character]);
  }

  function parseDatasetJson(value, fallback) {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeSelectedOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      const cleanKey = String(key || "").trim();
      const cleanValue = String(value[key] || "").trim();
      if (cleanKey && cleanValue) out[cleanKey] = cleanValue;
    });
    return out;
  }

  function selectedOptionsLabel(options) {
    return Object.keys(options || {})
      .map((key) => key + ": " + options[key])
      .join(" / ");
  }

  function normalizeProductId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const productId = String(raw.split("::")[0] || "").trim();
    return LEGACY_PRODUCT_ID_ALIASES[productId] || productId;
  }

  function variantRecords(product) {
    return Array.isArray(product && product.variants) ? product.variants : [];
  }

  function normalizeVariantSelectedOptions(variant) {
    return normalizeSelectedOptions(
      variant && (variant.selected_options || variant.selectedOptions)
    );
  }

  function findVariantRecord(product, variantId) {
    const cleanVariantId = String(variantId || "").trim();
    if (!cleanVariantId) return null;
    return (
      variantRecords(product).find((variant) => {
        return String(variant && variant.variant_id || "").trim() === cleanVariantId;
      }) || null
    );
  }

  function defaultVariantRecord(product) {
    return (
      findVariantRecord(product, product && product.default_variant_id) ||
      variantRecords(product)[0] ||
      null
    );
  }

  function variantImageUrl(variant) {
    return String(
      (variant && (variant.image_url || variant.image || variant.featured_image)) || ""
    ).trim();
  }

  function variantPriceValue(variant) {
    const cents = Number(variant && (variant.price_cents || variant.priceCents) || 0);
    if (Number.isFinite(cents) && cents > 0) return cents / 100;
    const price = Number(variant && variant.price || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  }

  function variantCompareAtValue(variant, price) {
    const cents = Number(
      variant && (variant.compare_at_price_cents || variant.compareAtPriceCents) || 0
    );
    if (Number.isFinite(cents) && cents > 0) {
      const compare = cents / 100;
      return compare > price ? compare : null;
    }
    const compare = Number(
      variant && (variant.compare_at_price || variant.compareAtPrice) || 0
    );
    return Number.isFinite(compare) && compare > price ? compare : null;
  }

  function directCartVariantData(product) {
    const variant = defaultVariantRecord(product);
    if (!variant) return null;

    const selectedOptions = normalizeVariantSelectedOptions(variant);
    return {
      variantId: String(variant.variant_id || "").trim(),
      sku: String(variant.sku || "").trim(),
      selectedOptions,
      variant: selectedOptionsLabel(selectedOptions),
      image: variantImageUrl(variant),
      price: variantPriceValue(variant),
      compareAtPrice: variantCompareAtValue(variant, variantPriceValue(variant)),
      currency: String(variant.currency || product && product.currency || "").trim(),
    };
  }

  function variantRecordPriceCents(variant, fallbackProduct) {
    const cents = Number(
      (variant && (variant.price_cents || variant.priceCents)) ||
      (fallbackProduct && fallbackProduct.price_cents) ||
      0
    );
    return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
  }

  function variantRecordCompareAtCents(variant, fallbackProduct) {
    const cents = Number(
      (variant && (
        variant.compare_at_price_cents ||
        variant.compareAtPriceCents ||
        variant.regular_price_cents
      )) ||
      (fallbackProduct && fallbackProduct.compare_at_price_cents) ||
      0
    );
    return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
  }

  function normalizeVariantKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function findVariantBySelectedValues(product, values) {
    const parts = Array.isArray(values)
      ? values.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!parts.length) return null;

    const joined = parts.join(" / ");
    const normalizedParts = parts.map(normalizeVariantKey).sort();
    return (
      variantRecords(product).find((variant) => {
        const key = normalizeVariantKey(variant && (variant.key || variant.title));
        if (key && key === normalizeVariantKey(joined)) return true;

        const optionValues = Array.isArray(variant && variant.optionValues)
          ? variant.optionValues
          : Array.isArray(variant && variant.option_values)
            ? variant.option_values.map((entry) => entry && entry.value)
            : [];
        if (optionValues.length !== parts.length) return false;
        if (
          optionValues.every(
            (value, index) => normalizeVariantKey(value) === normalizeVariantKey(parts[index])
          )
        ) {
          return true;
        }

        const normalizedVariantValues = optionValues.map(normalizeVariantKey).sort();
        return normalizedVariantValues.every((value, index) => value === normalizedParts[index]);
      }) || null
    );
  }

  function optionValuesText(values) {
    return Array.isArray(values)
      ? values
          .map((entry) => entry && (entry.value || entry.selected_value || entry.label || ""))
          .filter(Boolean)
          .join(" ")
      : "";
  }

  function productUrlSlug(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const clean = raw.split("?")[0].split("#")[0];
    const slug = clean.split("/").pop() || "";
    return slug.replace(/\.html?$/i, "");
  }

  function uniqueNormalizedSearchValues(values) {
    const seen = {};
    const out = [];
    values.forEach(function (value) {
      var normalized = normalizeSearchText(value);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      out.push(normalized);
    });
    return out;
  }

  function productSearchMeta(p) {
    if (!p._athSearchMeta) {
      var variants = variantRecords(p);
      var variantTerms = [];
      variants.forEach(function (variant) {
        variantTerms.push(
          variant && variant.variant_id,
          variant && variant.sku,
          variant && variant.title,
          optionValuesText(variant && variant.option_values),
          optionValuesText(
            variant && variant.selected_options
              ? Object.keys(variant.selected_options).map(function (name) {
                  return { name: name, value: variant.selected_options[name] };
                })
              : []
          )
        );
      });
      var identifiers = uniqueNormalizedSearchValues([
        p.id,
        p.external_product_id,
        p.sku,
        p.default_variant_id,
        p.url,
        productUrlSlug(p.url),
      ].concat(variantTerms));
      p._athSearchMeta = {
        name: normalizeSearchText(p.name),
        brand: normalizeSearchText(p.brand || p.brand_slug),
        nameWords: normalizeSearchText(p.name).split(" ").filter(Boolean),
        brandWords: normalizeSearchText(p.brand || p.brand_slug).split(" ").filter(Boolean),
        identifiers: identifiers,
        identifierCompacts: identifiers.map(function (value) { return value.replace(/ /g, ""); }),
      };
    }
    return p._athSearchMeta;
  }

  function normalizeCartItem(item) {
    if (!item || typeof item !== "object") return null;

    const rawId = String(item.id || item.productId || "").trim();
    const productId = normalizeProductId(item.productId || rawId);
    if (!productId) return null;

    const display = item.display && typeof item.display === "object" ? item.display : item;
    const storedVariant =
      rawId.includes("::") && !display.variant
        ? rawId.slice(rawId.indexOf("::") + 2)
        : display.variant;
    const variantId = String(item.variantId || item.variant_id || "").trim();
    const kitId = /^kl_[a-z0-9_-]{6,64}$/i.test(String(item.kitId || item.kit_id || ""))
      ? String(item.kitId || item.kit_id)
      : "";
    const selectedOptions = normalizeSelectedOptions(item.selectedOptions || item.selected_options);
    const variant = selectedOptionsLabel(selectedOptions) || String(storedVariant || "").trim();
    const quantity =
      item.quantity == null ? 1 : Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return null;

    const price = Number(display.price);
    const currency = String(display.currency || item.currency || "USD").toUpperCase();
    const baseId = variantId
      ? productId + "::" + variantId
      : variant
        ? productId + "::" + variant
        : productId;
    const id = kitId ? baseId + "::kit:" + kitId : baseId;
    return {
      id,
      productId,
      variantId,
      kitId,
      sku: String(display.sku || ""),
      brand: String(display.brand || ""),
      name: String(display.name || ""),
      price: Number.isFinite(price) && price > 0 ? price : 0,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      image: String(display.image || ""),
      selectedOptions,
      variant,
      quantity,
    };
  }

  function normalizeAddQuantity(value) {
    const quantity = value == null ? 1 : Math.floor(Number(value));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  function loadCart() {
    try {
      const parsed = JSON.parse(storageGet(CART_STORAGE_KEY, "[]"));
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && parsed.version === 2 && Array.isArray(parsed.items)
          ? parsed.items
          : [];
      return Array.isArray(items)
        ? items.map(normalizeCartItem).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    const items = cart.map(function (item) {
      return {
        productId: normalizeProductId(item.productId || item.id || ""),
        variantId: String(item.variantId || "").trim(),
        kitId: item.kitId || "",
        selectedOptions: normalizeSelectedOptions(item.selectedOptions),
        quantity: item.quantity,
        display: {
          sku: item.sku || "",
          brand: item.brand || "",
          name: item.name || "",
          image: item.image || "",
          variant: item.variant || "",
          currency: item.currency || "USD",
          price: Number(item.price || 0),
        },
      };
    });
    storageSet(CART_STORAGE_KEY, JSON.stringify({ version: 2, items: items }));
  }

  function formatMoney(value, currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(value || 0);
    } catch {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value || 0);
    }
  }

  function formatMoneyFromCents(cents, currency) {
    return formatMoney((Number(cents || 0) / 100), currency || "USD");
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildCartValidationSnapshot() {
    return cart.map((item) => ({
      productId: normalizeProductId(item.productId || item.id || ""),
      variant_id: String(item.variantId || "").trim(),
      kit_id: String(item.kitId || ""),
      selected_options: item.selectedOptions || {},
      variant: String(item.variant || "").trim(),
      quantity: item.quantity,
    }));
  }

  function snapshotSignature(snapshot) {
    try {
      return JSON.stringify(snapshot);
    } catch {
      return "";
    }
  }

  function setCartValidationState(nextState) {
    cartValidation = Object.assign({}, cartValidation, nextState);
  }

  function applyCartValidationPayload(payload, signature) {
    setCartValidationState({
      status: payload && payload.valid ? "valid" : "invalid",
      valid: Boolean(payload && payload.valid),
      signature,
      code: (payload && payload.code) || "",
      message: (payload && payload.message) || "",
      subtotalCents: Number(payload && payload.subtotal_cents) || 0,
      currency: String((payload && payload.currency) || "USD").toUpperCase(),
      items: Array.isArray(payload && payload.items) ? payload.items : [],
      lineItems: Array.isArray(payload && payload.line_items) ? payload.line_items : [],
      invalidItems: Array.isArray(payload && payload.invalid_items) ? payload.invalid_items : [],
      error: "",
    });
  }

  function applyValidatedCatalogLines() {
    if (!Array.isArray(cartValidation.lineItems) || !cartValidation.lineItems.length) return;
    var changed = false;
    cartValidation.lineItems.forEach(function (line) {
      var index = Number(line && line.input_index);
      if (!Number.isInteger(index) || !cart[index] || line.valid !== true) return;
      var item = cart[index];
      var unitCents = Number(line.unit_amount_cents || 0);
      if (Number.isFinite(unitCents) && unitCents > 0) {
        var unitPrice = unitCents / 100;
        if (item.price !== unitPrice) {
          item.price = unitPrice;
          changed = true;
        }
      }
      [
        ["productId", line.product_id],
        ["variantId", line.variant_id],
        ["brand", line.brand],
        ["name", line.name],
        ["image", line.image_url],
        ["currency", line.currency],
        ["variant", line.variant],
        ["sku", line.sku],
      ].forEach(function (pair) {
        var key = pair[0];
        var value = pair[1] == null ? "" : String(pair[1]);
        if (value && item[key] !== value) {
          item[key] = value;
          changed = true;
        }
      });
      if (line.selected_options && typeof line.selected_options === "object") {
        var selectedOptions = normalizeSelectedOptions(line.selected_options);
        if (JSON.stringify(item.selectedOptions || {}) !== JSON.stringify(selectedOptions)) {
          item.selectedOptions = selectedOptions;
          changed = true;
        }
      }
    });
    if (changed) saveCart();
  }

  function localCatalogValidationLines(snapshot, products) {
    var byId = liveProductMap(products);
    return snapshot.map(function (entry, index) {
      var product = byId.get(normalizeProductId(entry.productId));
      var variant = product && (
        findVariantRecord(product, entry.variant_id) ||
        findVariantBySelectedValues(
          product,
          Object.keys(entry.selected_options || {}).map(function (name) {
            return entry.selected_options[name];
          })
        ) ||
        variantRecords(product).find(function (candidate) {
          return (
            normalizeVariantKey(candidate && candidate.title) ===
            normalizeVariantKey(entry.variant)
          );
        }) ||
        (variantRecords(product).length === 1 ? defaultVariantRecord(product) : null) ||
        defaultVariantRecord(product)
      );
      var valid = Boolean(product && variant && variant.available !== false);
      var priceCents = valid ? variantRecordPriceCents(variant, product) : 0;
      var quantity = Math.max(1, Number(entry.quantity || 1));
      return {
        input_index: index,
        product_id: product ? String(product.id || "") : normalizeProductId(entry.productId),
        variant_id: valid ? String(variant.variant_id || "") : String(entry.variant_id || ""),
        variant: valid ? String(variant.title || "") : "",
        selected_options: valid ? normalizeVariantSelectedOptions(variant) : {},
        quantity: quantity,
        valid: valid,
        code: valid ? null : "variant_required",
        message: valid ? null : "Choose the required product options before checkout.",
        brand: product ? String(product.brand || "") : "",
        name: product ? String(product.name || "") : "",
        image_url: valid ? (variantImageUrl(variant) || String(product.image || "")) : "",
        currency: String((variant && variant.currency) || (product && product.currency) || "USD"),
        unit_amount_cents: priceCents,
        line_total_cents: priceCents * quantity,
      };
    });
  }

  function queueCartValidation(options) {
    const force = Boolean(options && options.force);
    const snapshot = buildCartValidationSnapshot();
    const signature = snapshotSignature(snapshot);

    if (!force && signature === cartValidation.signature && cartValidation.status !== "error") {
      return Promise.resolve(cartValidation);
    }

    if (snapshot.length === 0) {
      setCartValidationState({
        status: "empty",
        valid: false,
        signature,
        code: "empty_cart",
        message: "Add at least one product before checkout.",
        subtotalCents: 0,
        currency: "USD",
        items: [],
        lineItems: [],
        invalidItems: [],
        error: "",
      });
      renderCart();
      return Promise.resolve(cartValidation);
    }

    setCartValidationState({
      status: "loading",
      valid: false,
      signature,
      code: "",
      message: "Checking live catalog prices...",
      subtotalCents: Math.round(cartTotal() * 100),
      currency: cart[0] ? cart[0].currency || "USD" : "USD",
      items: [],
      lineItems: [],
      invalidItems: [],
      error: "",
    });
    renderCart();

    return fetch("/api/cart/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cart: snapshot }),
    })
      .then(function (response) {
        return response.text().then(function (raw) {
          var payload = {};
          if (raw) {
            try {
              payload = JSON.parse(raw);
            } catch (error) {
              payload = {};
            }
          }
          if (!response.ok) {
            throw new Error(payload.message || "Could not verify cart pricing.");
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (signature !== snapshotSignature(buildCartValidationSnapshot())) return cartValidation;
        applyCartValidationPayload(payload, signature);
        applyValidatedCatalogLines();
        renderCart();
        return cartValidation;
      })
      .catch(function (error) {
        if (signature !== snapshotSignature(buildCartValidationSnapshot())) return cartValidation;
        return fetchLiveCatalogProducts(snapshot.map(function (entry) { return entry.productId; })).then(function (products) {
          if (signature !== snapshotSignature(buildCartValidationSnapshot())) return cartValidation;
          var lineItems = localCatalogValidationLines(snapshot, products);
          setCartValidationState({
            status: "error",
            valid: false,
            signature,
            code: "cart_validation_failed",
            message: error.message || "Could not verify cart pricing.",
            subtotalCents: lineItems.reduce(function (sum, line) { return sum + Number(line.line_total_cents || 0); }, 0),
            currency: String(lineItems[0] && lineItems[0].currency || "USD"),
            lineItems: lineItems,
            invalidItems: lineItems.filter(function (line) { return line.valid === false; }),
            error: error.message || "Could not verify cart pricing.",
          });
          applyValidatedCatalogLines();
          renderCart();
          return cartValidation;
        });
      });
  }

  let liveCatalogProductsPromise = null;

  function fetchLiveCatalogProducts(productIds) {
    const ids = Array.isArray(productIds)
      ? Array.from(new Set(productIds.map(normalizeProductId).filter(Boolean)))
      : [];
    if (!ids.length) return Promise.resolve([]);

    const cacheKey = ids.slice().sort().join(",");
    if (liveCatalogProductsPromise && liveCatalogProductsPromise.cacheKey === cacheKey) {
      return liveCatalogProductsPromise;
    }

    const batches = [];
    for (let index = 0; index < ids.length; index += 50) {
      batches.push(ids.slice(index, index + 50));
    }
    liveCatalogProductsPromise = Promise.all(
      batches.map((batch) =>
        fetch("/api/catalog/products?ids=" + encodeURIComponent(batch.join(",")))
          .then((response) => {
            if (!response.ok) throw new Error("Failed to load live catalog products");
            return response.json();
          })
          .then((payload) => (Array.isArray(payload && payload.products) ? payload.products : []))
      )
    )
      .then((results) => results.flat())
      .catch(() =>
        fetch("/data/final/catalog.published.json")
          .then((response) => {
            if (!response.ok) throw new Error("Failed to load published catalog fallback");
            return response.json();
          })
          .then((payload) => {
            const wanted = new Set(ids);
            return (Array.isArray(payload && payload.products) ? payload.products : []).filter(
              (product) => wanted.has(normalizeProductId(product && product.id))
            );
          })
          .catch(() => [])
      );
    liveCatalogProductsPromise.cacheKey = cacheKey;
    return liveCatalogProductsPromise;
  }

  function liveProductMap(products) {
    return new Map(
      (Array.isArray(products) ? products : [])
        .map((product) => [String((product && product.id) || "").trim(), product])
        .filter((entry) => entry[0])
    );
  }

  function cartQuantity() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function applyLiveCardProduct(card, product) {
    if (!card || !product) return;

    const directVariant = directCartVariantData(product);
    const titleLink = $(".product-card-link", card);
    const imageLink = $(".product-image", card);
    const imageEl = imageLink ? $("img", imageLink) : null;
    const priceLine = $(".product-price-line", card);
    let addBtn = $(".add-cart-button", card);
    const href = primaryProductHref(product);
    const title = String(product.name || "").trim();
    const currency = (directVariant && directVariant.currency) || product.currency || "USD";
    const priceCents = directVariant
      ? Math.round(Number((directVariant.price || 0) * 100))
      : Math.round(Number(product.price_cents || 0));
    const compareCents = directVariant
      ? Math.round(Number((directVariant.compareAtPrice || 0) * 100))
      : Math.round(Number(product.compare_at_price_cents || 0));
    const cardImage = (directVariant && directVariant.image) || product.image || "";

    if (titleLink) {
      titleLink.textContent = title;
      titleLink.setAttribute("href", href);
    }
    if (imageLink) imageLink.setAttribute("href", href);
    if (imageEl && cardImage) {
      imageEl.src = cardImage;
      imageEl.alt = title;
    }
    if (priceLine) {
      priceLine.innerHTML =
        "<strong>" + esc(formatMoneyFromCents(priceCents, currency)) + "</strong>" +
        (compareCents > priceCents
          ? "<span>" + esc(formatMoneyFromCents(compareCents, currency)) + "</span>"
          : "");
    }
    const requiresSelection =
      Boolean(product.requires_variant_selection || product.variant_offer) ||
      variantRecords(product).length > 1;
    if (addBtn && requiresSelection) {
      if (addBtn.tagName !== "BUTTON") {
        const replacement = document.createElement("button");
        replacement.className = "add-cart-button";
        replacement.type = "button";
        addBtn.replaceWith(replacement);
        addBtn = replacement;
      }
      addBtn.removeAttribute("data-add-to-cart");
      addBtn.setAttribute("data-quick-add", "");
      addBtn.dataset.productId = String(product.id || "");
      addBtn.dataset.productHref = href;
      addBtn.textContent = "Add to cart";
      addBtn.setAttribute("aria-label", "Choose options and add " + title + " to cart");
    } else if (addBtn) {
      if (addBtn.tagName !== "BUTTON") {
        const replacement = document.createElement("button");
        replacement.className = "add-cart-button";
        replacement.type = "button";
        addBtn.replaceWith(replacement);
        addBtn = replacement;
      }
      addBtn.removeAttribute("data-quick-add");
      addBtn.setAttribute("data-add-to-cart", "");
      addBtn.dataset.cartId = String(product.id || "");
      addBtn.dataset.cartProductId = String(product.id || "");
      addBtn.dataset.cartVariantId =
        (directVariant && directVariant.variantId) || String(product.default_variant_id || "");
      addBtn.dataset.cartBrand = String(product.brand || "");
      addBtn.dataset.cartName = title;
      addBtn.dataset.cartPrice = ((priceCents || 0) / 100).toFixed(2);
      addBtn.dataset.cartPriceCents = String(priceCents || 0);
      addBtn.dataset.cartCurrency = currency;
      addBtn.dataset.cartImage = cardImage;
      addBtn.dataset.cartSelectedOptions = JSON.stringify(
        (directVariant && directVariant.selectedOptions) || {}
      );
      addBtn.dataset.cartVariant = (directVariant && directVariant.variant) || "";
      addBtn.textContent = "Add to cart";
      addBtn.setAttribute("aria-label", "Add " + title + " to cart");
    }
  }

  function refreshVisibleCatalogCards() {
    if (document.body?.classList.contains("home-body")) return;
    const cards = $$(".product-card[data-product-id]:not([hidden])");
    const ids = cards
      .map((card) => normalizeProductId(card.getAttribute("data-product-id")))
      .filter(Boolean);
    if (!ids.length) return;

    fetchLiveCatalogProducts(ids).then((products) => {
      const byId = liveProductMap(products);
      cards.forEach((card) => {
        const product = byId.get(normalizeProductId(card.getAttribute("data-product-id")));
        if (product) applyLiveCardProduct(card, product);
      });
    });
  }

  let quickAddDialog = null;
  let quickAddProduct = null;
  let quickAddVariant = null;
  let quickAddTrigger = null;

  function ensureQuickAddDialog() {
    if (quickAddDialog) return quickAddDialog;
    quickAddDialog = document.createElement("dialog");
    quickAddDialog.className = "quick-add-dialog";
    quickAddDialog.setAttribute("aria-labelledby", "quick-add-title");
    quickAddDialog.innerHTML =
      '<div class="quick-add-shell">' +
        '<button class="quick-add-close" type="button" data-quick-add-close aria-label="Close option selector">&times;</button>' +
        '<div class="quick-add-product">' +
          '<img data-quick-add-image src="" alt="" />' +
          '<div><p data-quick-add-brand></p><h2 id="quick-add-title" data-quick-add-title></h2>' +
          '<div class="quick-add-price" data-quick-add-price></div></div>' +
        '</div>' +
        '<form data-quick-add-form>' +
          '<div class="quick-add-options" data-quick-add-options></div>' +
          '<p class="quick-add-status" data-quick-add-status aria-live="polite"></p>' +
          '<button class="quick-add-submit" type="submit" data-quick-add-submit disabled>Select options</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(quickAddDialog);

    quickAddDialog.addEventListener("click", (event) => {
      if (
        event.target === quickAddDialog ||
        event.target.closest("[data-quick-add-close]")
      ) {
        quickAddDialog.close();
      }
    });
    quickAddDialog.addEventListener("close", () => {
      if (quickAddTrigger && quickAddTrigger.isConnected) quickAddTrigger.focus();
      quickAddProduct = null;
      quickAddVariant = null;
      quickAddTrigger = null;
    });
    $("[data-quick-add-form]", quickAddDialog).addEventListener("submit", (event) => {
      event.preventDefault();
      if (!quickAddProduct || !quickAddVariant) return;
      const selectedOptions = normalizeVariantSelectedOptions(quickAddVariant);
      const priceCents = variantRecordPriceCents(quickAddVariant, quickAddProduct);
      const button = document.createElement("button");
      button.dataset.cartId = String(quickAddProduct.id || "");
      button.dataset.cartProductId = String(quickAddProduct.id || "");
      button.dataset.cartVariantId = String(quickAddVariant.variant_id || "");
      button.dataset.cartSku = String(quickAddVariant.sku || "");
      button.dataset.cartBrand = String(quickAddProduct.brand || "");
      button.dataset.cartName = String(quickAddProduct.name || "");
      button.dataset.cartPrice = (priceCents / 100).toFixed(2);
      button.dataset.cartPriceCents = String(priceCents);
      button.dataset.cartCurrency = String(
        quickAddVariant.currency || quickAddProduct.currency || "USD"
      );
      button.dataset.cartImage = String(
        variantImageUrl(quickAddVariant) || quickAddProduct.image || ""
      );
      button.dataset.cartSelectedOptions = JSON.stringify(selectedOptions);
      button.dataset.cartVariant = selectedOptionsLabel(selectedOptions);
      quickAddDialog.close();
      addToCartFromButton(button);
    });
    return quickAddDialog;
  }

  function quickAddOptionGroups(product) {
    const groups = new Map();
    variantRecords(product).forEach((variant) => {
      const selected = normalizeVariantSelectedOptions(variant);
      Object.keys(selected).forEach((name) => {
        if (!groups.has(name)) groups.set(name, []);
        if (!groups.get(name).includes(selected[name])) groups.get(name).push(selected[name]);
      });
    });
    return groups;
  }

  function renderQuickAddSelection() {
    if (!quickAddDialog || !quickAddProduct) return;
    const selects = $$("[data-quick-add-option]", quickAddDialog);
    const chosen = {};
    selects.forEach((select) => {
      if (select.value) chosen[select.dataset.optionName] = select.value;
    });
    const complete = selects.length > 0 && selects.every((select) => select.value);
    quickAddVariant = complete
      ? variantRecords(quickAddProduct).find((variant) => {
          const selected = normalizeVariantSelectedOptions(variant);
          return (
            variant.available !== false &&
            Object.keys(chosen).every((name) => selected[name] === chosen[name])
          );
        }) || null
      : null;
    const submit = $("[data-quick-add-submit]", quickAddDialog);
    const status = $("[data-quick-add-status]", quickAddDialog);
    submit.disabled = !quickAddVariant;
    submit.textContent = quickAddVariant ? "Add to cart" : "Select options";
    status.textContent = complete && !quickAddVariant
      ? "That combination is currently unavailable."
      : "";
    if (quickAddVariant) {
      const priceCents = variantRecordPriceCents(quickAddVariant, quickAddProduct);
      const compareCents = variantRecordCompareAtCents(quickAddVariant, quickAddProduct);
      $("[data-quick-add-price]", quickAddDialog).innerHTML =
        "<strong>" +
        esc(formatMoneyFromCents(
          priceCents,
          quickAddVariant.currency || quickAddProduct.currency || "USD"
        )) +
        "</strong>" +
        (compareCents > priceCents
          ? "<s>" +
            esc(formatMoneyFromCents(
              compareCents,
              quickAddVariant.currency || quickAddProduct.currency || "USD"
            )) +
            "</s>"
          : "");
    }
  }

  function productFromPdp(href, fallbackId) {
    if (!href) return Promise.resolve(null);
    return fetch(href)
      .then((response) => {
        if (!response.ok) throw new Error("Product page unavailable");
        return response.text();
      })
      .then((html) => {
        const documentCopy = new DOMParser().parseFromString(html, "text/html");
        const button = documentCopy.querySelector("[data-pdp-add-button]");
        const title = documentCopy.querySelector("[data-pdp-title]");
        const image = documentCopy.querySelector("#pdp-main-image");
        const match = html.match(/\bvar\s+variantPricing\s*=\s*(\[[\s\S]*?\]);/);
        const variants = match ? JSON.parse(match[1]) : [];
        if (!button || !title || !variants.length) return null;
        return {
          id: button.dataset.cartId || fallbackId,
          brand: button.dataset.cartBrand || "",
          name: title.textContent.trim(),
          image: (image && image.src) || button.dataset.cartImage || "",
          currency: button.dataset.cartCurrency || "USD",
          price_cents: Math.round(Number(button.dataset.cartPrice || 0) * 100),
          variants,
          requires_variant_selection: true,
          url: href,
        };
      })
      .catch(() => null);
  }

  function openQuickAdd(productId, href, trigger) {
    const dialog = ensureQuickAddDialog();
    quickAddTrigger = trigger || null;
    quickAddProduct = null;
    quickAddVariant = null;
    $("[data-quick-add-title]", dialog).textContent = "Loading product…";
    $("[data-quick-add-brand]", dialog).textContent = "";
    $("[data-quick-add-price]", dialog).textContent = "";
    $("[data-quick-add-options]", dialog).innerHTML = "";
    $("[data-quick-add-status]", dialog).textContent = "";
    const submit = $("[data-quick-add-submit]", dialog);
    submit.disabled = true;
    submit.textContent = "Loading…";
    if (!dialog.open) dialog.showModal();

    let inlineProduct = null;
    try {
      inlineProduct = trigger && trigger.dataset.quickAddProduct
        ? JSON.parse(trigger.dataset.quickAddProduct)
        : null;
    } catch (_) {
      inlineProduct = null;
    }

    fetchLiveCatalogProducts([productId])
      .then((products) => {
        const product =
          products.find(
            (entry) => normalizeProductId(entry && entry.id) === normalizeProductId(productId)
          ) || null;
        return product || inlineProduct || productFromPdp(href, productId);
      })
      .then((product) => {
        if (!product) {
          dialog.close();
          if (href) window.location.href = href;
          return;
        }
        quickAddProduct = product;
        const groups = quickAddOptionGroups(product);
        const image = $("[data-quick-add-image]", dialog);
        image.src = product.image || "";
        image.alt = product.name || "";
        $("[data-quick-add-title]", dialog).textContent = product.name || "Choose options";
        $("[data-quick-add-brand]", dialog).textContent = product.brand || "";
        const options = $("[data-quick-add-options]", dialog);
        options.innerHTML = Array.from(groups.entries())
          .map(([name, values]) =>
            '<label><span>' + esc(name) + '</span><select data-quick-add-option data-option-name="' +
            esc(name) + '"><option value="">Select ' + esc(name) + "…</option>" +
            values.map((value) => '<option value="' + esc(value) + '">' + esc(value) + "</option>").join("") +
            "</select></label>"
          )
          .join("");
        $$("[data-quick-add-option]", dialog).forEach((select) => {
          select.addEventListener("change", renderQuickAddSelection);
        });
        renderQuickAddSelection();
      });
  }

  /* Generated PDPs normally carry their own variant records and controller.
     Some imported PDPs intentionally have an empty inline variant payload;
     only those pages are owned by this live controller. The capture-phase
     listener prevents the empty inline controller from clearing variant IDs.
     No visible product state is changed until every option is explicitly
     selected by the customer. */
  function initEmptyInlinePdpController() {
    const addBtn = document.querySelector("[data-pdp-add-button]");
    const titleEl = document.querySelector("[data-pdp-title]");
    const priceEl = document.querySelector("[data-pdp-price]");
    const priceRow = document.querySelector("[data-pdp-price-row]");
    const selects = Array.from(document.querySelectorAll("[data-pdp-variant]"));
    if (!addBtn || !titleEl || !priceEl || !priceRow || !selects.length) return;

    const hasEmptyInlinePayload = Array.from(document.scripts).some((script) =>
      /\bvar\s+variantPricing\s*=\s*\[\s*\]\s*;/.test(script.textContent || "")
    );
    if (!hasEmptyInlinePayload) return;

    const compareEl = document.querySelector("[data-pdp-compare]");
    const discountEl = document.querySelector("[data-pdp-discount]");
    const availabilityEl = document.querySelector(".pdp-availability");
    const noteEl = document.querySelector("[data-pdp-cta-note]");
    const mainImg = document.getElementById("pdp-main-image");
    const productId = normalizeProductId(addBtn.dataset.cartProductId || addBtn.dataset.cartId);
    const currency = String(priceRow.dataset.currency || addBtn.dataset.cartCurrency || "USD");
    const baseTitle = String(titleEl.textContent || addBtn.dataset.cartName || "").trim();
    const baseDocumentTitle = document.title;
    const basePriceText = priceEl.textContent;
    const baseCompareText = compareEl ? compareEl.textContent : "";
    const baseCompareHidden = compareEl ? compareEl.hidden : true;
    const baseDiscountText = discountEl ? discountEl.textContent : "";
    const baseDiscountHidden = discountEl ? discountEl.hidden : true;
    const baseAvailability = availabilityEl ? availabilityEl.textContent : "";
    const baseImage = mainImg ? mainImg.getAttribute("src") || "" : "";
    const baseCartPrice = addBtn.dataset.cartPrice || "";
    let liveProduct = null;

    function clearVariantMetadata() {
      addBtn.dataset.cartVariantId = "";
      addBtn.dataset.cartSelectedOptions = "{}";
      addBtn.dataset.cartSku = "";
      addBtn.dataset.cartVariant = "";
      addBtn.dataset.cartName = baseTitle;
      addBtn.dataset.cartImage = baseImage;
      addBtn.dataset.cartPrice = baseCartPrice;
    }

    function restoreBaseState() {
      titleEl.textContent = baseTitle;
      document.title = baseDocumentTitle;
      priceEl.textContent = basePriceText;
      if (compareEl) {
        compareEl.textContent = baseCompareText;
        compareEl.hidden = baseCompareHidden;
      }
      if (discountEl) {
        discountEl.textContent = baseDiscountText;
        discountEl.hidden = baseDiscountHidden;
      }
      if (availabilityEl) availabilityEl.textContent = baseAvailability;
      if (mainImg && baseImage) mainImg.src = baseImage;
      clearVariantMetadata();
      addBtn.disabled = true;
      addBtn.textContent = "Select options";
      if (noteEl) noteEl.textContent = "";
    }

    function renderExplicitSelection() {
      const values = selects.map((select) => String(select.value || "").trim());
      if (values.some((value) => !value)) {
        restoreBaseState();
        return;
      }
      if (!liveProduct) {
        addBtn.disabled = true;
        addBtn.textContent = "Loading options…";
        if (noteEl) noteEl.textContent = "Checking this option…";
        return;
      }

      const variant = findVariantBySelectedValues(liveProduct, values);
      if (!variant || variant.available === false) {
        restoreBaseState();
        addBtn.textContent = "Unavailable";
        if (noteEl) noteEl.textContent = "This option is currently unavailable.";
        return;
      }

      const variantTitle = String(variant.title || values.join(" / ")).trim();
      const mergedTitle = variantTitle ? baseTitle + " - " + variantTitle : baseTitle;
      const priceCents = variantRecordPriceCents(variant, liveProduct);
      const compareCents = variantRecordCompareAtCents(variant, liveProduct);
      const selectedOptions = normalizeVariantSelectedOptions(variant);
      const imageUrl = variantImageUrl(variant) || baseImage;

      titleEl.textContent = mergedTitle;
      document.title = mergedTitle + baseDocumentTitle.slice(baseTitle.length);
      priceEl.textContent = formatMoneyFromCents(priceCents, currency);
      if (compareEl) {
        compareEl.hidden = !(compareCents > priceCents);
        compareEl.textContent = compareCents > priceCents
          ? formatMoneyFromCents(compareCents, currency)
          : "";
      }
      if (discountEl) {
        discountEl.hidden = !(compareCents > priceCents);
        discountEl.textContent = compareCents > priceCents ? "Limited offer" : "";
      }
      if (availabilityEl) availabilityEl.textContent = "In stock";
      if (mainImg && imageUrl) {
        mainImg.src = imageUrl;
        mainImg.alt = mergedTitle;
        if (window.AthletonicPdpImage) window.AthletonicPdpImage.markActive(imageUrl);
      }

      addBtn.dataset.cartVariantId = String(variant.variant_id || "");
      addBtn.dataset.cartSelectedOptions = JSON.stringify(selectedOptions);
      addBtn.dataset.cartSku = String(variant.sku || "");
      addBtn.dataset.cartVariant = variantTitle;
      addBtn.dataset.cartName = mergedTitle;
      addBtn.dataset.cartImage = imageUrl;
      addBtn.dataset.cartPrice = (priceCents / 100).toFixed(2);
      addBtn.disabled = !addBtn.dataset.cartVariantId;
      addBtn.textContent = addBtn.disabled ? "Unavailable" : "Add to cart";
      if (noteEl) noteEl.textContent = addBtn.disabled ? "This option is currently unavailable." : "";
    }

    clearVariantMetadata();
    selects.forEach((select) => {
      select.addEventListener("change", (event) => {
        event.stopImmediatePropagation();
        window.requestAnimationFrame(renderExplicitSelection);
      }, true);
    });

    fetchLiveCatalogProducts([productId]).then((products) => {
      liveProduct = products.find(
        (product) => normalizeProductId(product && product.id) === productId
      ) || null;
      if (selects.every((select) => String(select.value || "").trim())) {
        renderExplicitSelection();
      }
    });
  }

  function setExpanded(buttons, expanded) {
    for (const button of buttons) {
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
  }

  function focusDrawer(panel, preferredSelector) {
    window.requestAnimationFrame(() => {
      const preferred = preferredSelector ? $(preferredSelector, panel) : null;
      const fallback = $(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        panel
      );
      const target = preferred || fallback;
      if (!target) return;
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    });
  }

  function openPanel(panel, trigger, buttons, focusSelector) {
    if (!panel || !drawerOverlay) return;
    closePanels({ restoreFocus: false });
    lastDrawerTrigger = trigger || null;
    drawerOverlay.hidden = false;
    document.body.classList.add("drawer-is-open");
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    setExpanded(buttons, true);
    focusDrawer(panel, focusSelector);
  }

  function closePanels(options) {
    const restoreFocus = !options || options.restoreFocus !== false;
    if (drawerOverlay) drawerOverlay.hidden = true;
    if (cartDrawer) {
      cartDrawer.hidden = true;
      cartDrawer.setAttribute("aria-hidden", "true");
    }
    if (accountPanel) {
      accountPanel.hidden = true;
      accountPanel.setAttribute("aria-hidden", "true");
    }
    setExpanded(cartOpenButtons, false);
    setExpanded(accountOpenButtons, false);
    document.body.classList.remove("drawer-is-open");
    if (restoreFocus && lastDrawerTrigger?.isConnected) {
      try {
        lastDrawerTrigger.focus({ preventScroll: true });
      } catch {
        lastDrawerTrigger.focus();
      }
    }
    lastDrawerTrigger = null;
  }

  function openCart(trigger) {
    openPanel(cartDrawer, trigger, cartOpenButtons, "[data-cart-close]");
  }

  // Supabase session key for auth-aware header button
  const SB_SESSION_KEY = "sb-spdvsaozvdcvztinsuex-auth-token";

  function getStoredAuthSession() {
    try {
      const raw = localStorage.getItem(SB_SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const session = data && data.access_token ? data : null;
      if (!session) return null;
      const exp = session.expires_at;
      if (exp && Date.now() / 1000 > exp) return null;
      return session;
    } catch (e) {
      return null;
    }
  }

  function renderAccountPanel() {
    if (!accountPanel) return;
    const prefix = pagePathPrefix();
    let actions = accountPanel.querySelector("[data-account-actions]");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "account-actions";
      actions.setAttribute("data-account-actions", "");
      const header = accountPanel.querySelector(".drawer-header");
      if (header && header.nextSibling) {
        accountPanel.insertBefore(actions, header.nextSibling);
      } else if (header) {
        header.insertAdjacentElement("afterend", actions);
      } else {
        accountPanel.prepend(actions);
      }
    }

    const title = accountPanel.querySelector("#account-title");
    const eyebrow = accountPanel.querySelector(".drawer-eyebrow");
    const session = getStoredAuthSession();
    const returnTo = encodeURIComponent(window.location.href);
    if (accountForm) accountForm.hidden = true;
    if (eyebrow) {
      eyebrow.className = "account-panel-logo";
      eyebrow.innerHTML = '<img src="' + prefix + 'assets/logo.png" alt="Athletonic" width="1536" height="1024" decoding="async">';
    }

    if (session && session.user) {
      const meta = session.user.user_metadata || {};
      const fullName = meta.full_name || meta.name || "";
      const firstName = fullName
        ? fullName.trim().split(" ")[0]
        : (session.user.email || "").split("@")[0];
      if (title) title.textContent = "Hello, " + (firstName || "athlete");
      actions.innerHTML =
        '<p class="account-user-email">' + escapeMarkup(session.user.email || "") + '</p>' +
        '<a class="account-panel-link" href="' + prefix + 'pages/account.html"><span>Your account</span><small>Orders, details and security</small></a>' +
        '<button type="button" class="account-action-signout" data-account-signout>Sign out</button>';
    } else {
      if (title) title.textContent = "Welcome";
      actions.innerHTML =
        '<a class="account-action-primary" href="' + prefix + 'pages/login.html?return_to=' + returnTo + '">Sign in</a>' +
        '<a class="account-action-secondary" href="' + prefix + 'pages/login.html?return_to=' + returnTo + '&tab=create">Create account</a>';
    }
  }

  async function signOutFromPanel() {
    const session = getStoredAuthSession();
    if (session && session.access_token && SUPABASE_PUBLIC_URL && SUPABASE_PUBLIC_KEY) {
      try {
        await fetch(String(SUPABASE_PUBLIC_URL).replace(/\/$/, "") + "/auth/v1/logout", {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: "Bearer " + session.access_token,
          },
        });
      } catch (e) {
        /* Local sign-out still completes when the network is unavailable. */
      }
    }
    try {
      localStorage.removeItem(SB_SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
    window.location.href = pagePathPrefix();
  }

  function openAccount(trigger) {
    if (!accountPanel) {
      const session = getStoredAuthSession();
      const prefix = pagePathPrefix();
      window.location.href = session
        ? prefix + "pages/account.html"
        : prefix + "pages/login.html?return_to=" + encodeURIComponent(window.location.href);
      return;
    }
    renderAccountPanel();
    openPanel(accountPanel, trigger, accountOpenButtons, "[data-account-close]");
  }

  function setFormStatus(element, message, state) {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state || "";
  }

  function hydrateEmailFields() {
    const session = getStoredAuthSession();
    const sessionEmail =
      session && session.user && session.user.email ? session.user.email : "";
    const email = sessionEmail || storageGet(GUEST_EMAIL_KEY, "");
    if (accountEmail) accountEmail.value = email;
    if (checkoutEmail) checkoutEmail.value = email;
    if (accountLabel) {
      const session = getStoredAuthSession();
      if (session && session.user) {
        const meta = session.user.user_metadata || {};
        const fullName = meta.full_name || meta.name || "";
        const firstName = fullName
          ? fullName.trim().split(" ")[0]
          : (session.user.email || "").split("@")[0];
        accountLabel.textContent = firstName || "Account";
      } else {
        accountLabel.textContent = "Sign in";
      }
    }
  }

  function isSpanishPage() {
    const htmlLang = String(document.documentElement.lang || "").toLowerCase();
    if (htmlLang) return htmlLang.startsWith("es");
    return /^\/es(\/|$)/.test(window.location.pathname);
  }

  const CHECKOUT_COPY = {
    en: {
      submit: "Buy Now",
      pending: "Opening secure checkout...",
      note:
        "Complete your purchase through secure checkout.",
    },
    es: {
      submit: "Comprar ahora",
      pending: "Abriendo el pago seguro...",
      note:
        "Completa tu compra mediante el pago seguro.",
    },
  };

  function checkoutCopy() {
    return isSpanishPage() ? CHECKOUT_COPY.es : CHECKOUT_COPY.en;
  }

  function applyCheckoutLabels() {
    const copy = checkoutCopy();
    if (checkoutSubmit) checkoutSubmit.textContent = copy.submit;
    const note = checkoutForm ? $(".form-note", checkoutForm) : null;
    if (note) note.textContent = copy.note;
  }

  function readCookie(name) {
    const prefix = name + "=";
    return document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || "";
  }

  function captureAttribution() {
    const params = new URLSearchParams(window.location.search);
    const attribution = {
      landing_page: window.location.href,
      referrer: document.referrer || "",
      client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
    };

    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
    ]) {
      if (params.get(key)) attribution[key] = params.get(key);
    }

    return attribution;
  }

  function cartKitDiscountCents() {
    if (cartValidation.status !== "valid") {
      if (cartValidation.status === "invalid" || cartValidation.status === "error") return 0;
      const groups = new Map();
      for (const item of cart) {
        if (!item.kitId) continue;
        if (!groups.has(item.kitId)) groups.set(item.kitId, { products: new Set(), subtotal: 0 });
        const group = groups.get(item.kitId);
        group.products.add(String(item.productId || ""));
        group.subtotal += Math.round(Number(item.price || 0) * 100) * Number(item.quantity || 0);
      }
      let estimatedSavings = 0;
      for (const group of groups.values()) {
        if (group.products.size >= 3 && group.subtotal > 0) estimatedSavings += Math.round(group.subtotal / 10);
      }
      return estimatedSavings;
    }
    const groups = new Map();
    for (const line of cartValidation.lineItems || []) {
      const item = cart[Number(line.input_index)];
      if (!item?.kitId || line.valid !== true) continue;
      if (!groups.has(item.kitId)) groups.set(item.kitId, { products: new Set(), subtotal: 0 });
      const group = groups.get(item.kitId);
      group.products.add(String(line.product_id || ""));
      group.subtotal += Number(line.line_total_cents || 0);
    }
    let savings = 0;
    for (const group of groups.values()) {
      if (group.products.size >= 3) savings += Math.round(group.subtotal / 10);
    }
    return savings;
  }

  function renderKitSavings(subtotalCents, currency) {
    if (!checkoutForm) return;
    const totalRow = $(".cart-total", checkoutForm);
    if (!totalRow) return;
    let savingsRow = $("[data-cart-kit-savings]", checkoutForm);
    let afterRow = $("[data-cart-kit-total]", checkoutForm);
    if (!savingsRow) {
      savingsRow = document.createElement("div");
      savingsRow.className = "cart-total cart-discount-row";
      savingsRow.dataset.cartKitSavings = "";
      savingsRow.innerHTML = '<span>Kit Lab · 10% off</span><strong data-cart-kit-savings-amount></strong>';
      afterRow = document.createElement("div");
      afterRow.className = "cart-total cart-final-row";
      afterRow.dataset.cartKitTotal = "";
      afterRow.innerHTML = '<span>After kit discount</span><strong data-cart-kit-total-amount></strong>';
      totalRow.after(savingsRow, afterRow);
    }
    const discountCents = cartKitDiscountCents();
    savingsRow.hidden = discountCents === 0;
    afterRow.hidden = discountCents === 0;
    if (discountCents) {
      $("[data-cart-kit-savings-amount]", savingsRow).textContent = "−" + formatMoneyFromCents(discountCents, currency);
      $("[data-cart-kit-total-amount]", afterRow).textContent = formatMoneyFromCents(subtotalCents - discountCents, currency);
    }
  }

  function renderCart() {
    const totalItems = cartQuantity();
    const subtotalCents =
      cartValidation.status === "valid" || cartValidation.status === "invalid"
        ? cartValidation.subtotalCents
        : Math.round(cartTotal() * 100);
    const subtotalCurrency = cartValidation.currency || (cart[0] && cart[0].currency) || "USD";
    for (const cartCount of cartCounts) {
      cartCount.textContent = String(totalItems);
      cartCount.hidden = totalItems === 0;
    }
    if (cartSubtotal) {
      cartSubtotal.textContent = cart.length && subtotalCents <= 0
        ? (cartValidation.status === "invalid" ? "Review items" : "Updating price…")
        : formatMoneyFromCents(subtotalCents, subtotalCurrency);
    }
    renderKitSavings(subtotalCents, subtotalCurrency);
    if (!cartItems) return;
    cartItems.textContent = "";

    if (cart.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-cart";
      const message = document.createElement("p");
      message.textContent = "Your cart is empty.";
      const action = document.createElement("button");
      action.type = "button";
      action.dataset.cartClose = "";
      action.textContent = "Continue shopping";
      empty.append(message, action);
      cartItems.append(empty);
      if (checkoutForm) checkoutForm.hidden = true;
      if (checkoutSubmit) checkoutSubmit.disabled = true;
      if (!checkoutBusy) setFormStatus(checkoutStatus, "", "");
      return;
    }

    if (checkoutForm) checkoutForm.hidden = false;
    const canCheckout = !checkoutBusy && cart.length > 0;
    if (checkoutSubmit) checkoutSubmit.disabled = !canCheckout;

    if (!checkoutBusy) {
      if (cartValidation.status === "loading") {
        setFormStatus(checkoutStatus, "Checking live catalog prices...", "pending");
      } else if (cartValidation.status === "invalid") {
        setFormStatus(
          checkoutStatus,
          cartValidation.message || "Review the highlighted cart item before checkout.",
          "error"
        );
      } else if (cartValidation.status === "error") {
        setFormStatus(
          checkoutStatus,
          cartValidation.message || "Could not verify cart right now.",
          "error"
        );
      } else if (cartValidation.status === "valid") {
        setFormStatus(checkoutStatus, "", "");
      }
    }

    const validationLines = new Map(
      (Array.isArray(cartValidation.lineItems) ? cartValidation.lineItems : []).map((line) => [
        Number(line && line.input_index),
        line,
      ])
    );

    cart.forEach((item, index) => {
      const validationLine = validationLines.get(index) || null;
      const isInvalid = Boolean(validationLine && validationLine.valid === false);
      const isValidated = Boolean(validationLine && validationLine.valid === true);
      const article = document.createElement("article");
      article.className = "cart-item";
      article.dataset.validation = isInvalid ? "invalid" : isValidated ? "valid" : "pending";
      article.setAttribute("aria-invalid", isInvalid ? "true" : "false");

      const image = document.createElement("img");
      image.src =
        (isValidated && validationLine && validationLine.image_url) ||
        item.image ||
        "";
      image.alt =
        isValidated && validationLine && validationLine.name
          ? validationLine.variant
            ? validationLine.name + " — " + validationLine.variant
            : validationLine.name
          : item.variant
            ? item.name + " — " + item.variant
            : item.name;
      image.width = 78;
      image.height = 78;
      image.loading = "lazy";
      image.decoding = "async";

      const body = document.createElement("div");
      body.className = "cart-item-body";

      const brand = document.createElement("span");
      brand.textContent = isValidated && validationLine && validationLine.brand
        ? validationLine.brand
        : item.brand;

      const itemName = isValidated && validationLine && validationLine.name
        ? validationLine.name
        : item.name;
      const itemVariant = isValidated && validationLine && validationLine.variant
        ? validationLine.variant
        : item.variant;
      const itemTitle = itemVariant ? itemName + " — " + itemVariant : itemName;
      const title = document.createElement("h3");
      title.textContent = itemTitle;

      const price = document.createElement("strong");
      const lineCurrency =
        (isValidated && validationLine && validationLine.currency) || item.currency;
      if (isInvalid) {
        price.textContent = "Price unavailable";
      } else {
        const lineTotalCents = isValidated && validationLine
          ? Number(validationLine.line_total_cents || 0)
          : Math.max(0, Math.round(Number(item.price || 0) * 100) * item.quantity);
        price.textContent =
          lineTotalCents > 0 ? formatMoneyFromCents(lineTotalCents, lineCurrency) : "Checking price...";
      }
      let lineError = null;
      if (isInvalid && validationLine && validationLine.message) {
        lineError = document.createElement("p");
        lineError.className = "cart-item-error";
        lineError.textContent = validationLine.message;
      }

      const controls = document.createElement("div");
      controls.className = "cart-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.cartDecrement = item.id;
      minus.setAttribute("aria-label", "Decrease quantity for " + itemTitle);
      minus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';

      const quantity = document.createElement("span");
      quantity.textContent = String(item.quantity);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.cartIncrement = item.id;
      plus.setAttribute("aria-label", "Increase quantity for " + itemTitle);
      plus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>';

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove-button";
      remove.dataset.cartRemove = item.id;
      remove.setAttribute("aria-label", "Remove " + itemTitle + " from cart");
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';

      controls.append(minus, quantity, plus, remove);
      body.append(brand, title, price);
      if (lineError) body.append(lineError);
      body.append(controls);

      article.append(image, body);
      cartItems.append(article);
    });
  }

  /**
   * Adds a product to the cart.
   * @param {object} payload - { id, brand, name, price, currency, image, variantId?, selectedOptions? }
   */
  function addItems(payloads) {
    let added = false;
    for (const payload of Array.isArray(payloads) ? payloads : []) {
      if (!payload || !payload.id) continue;
      const productId = normalizeProductId(payload.productId || payload.id);
      if (!productId) continue;
      const quantity = normalizeAddQuantity(payload.quantity);
      const selectedOptions = normalizeSelectedOptions(payload.selectedOptions);
      const variant = selectedOptionsLabel(selectedOptions) || String(payload.variant || "").trim();
      const variantId = String(payload.variantId || payload.variant_id || "").trim();
      const kitId = /^kl_[a-z0-9_-]{6,64}$/i.test(String(payload.kitId || payload.kit_id || ""))
        ? String(payload.kitId || payload.kit_id)
        : "";
      const baseId = variantId
        ? productId + "::" + variantId
        : variant
          ? productId + "::" + variant
          : productId;
      const cartId = kitId ? baseId + "::kit:" + kitId : baseId;
      const existing = cart.find((cartItem) => cartItem.id === cartId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        const currency = String(payload.currency || "USD").toUpperCase();
        const price = Number(payload.price || 0);
        cart.push({
          id: cartId,
          productId,
          variantId,
          kitId,
          sku: String(payload.sku || ""),
          brand: payload.brand || "",
          name: payload.name || "",
          price: Number.isFinite(price) && price > 0 ? price : 0,
          currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
          image: payload.image || "",
          selectedOptions,
          variant,
          quantity,
        });
      }
      added = true;
    }
    if (!added) return;
    saveCart();
    setFormStatus(checkoutStatus, "", "");
    queueCartValidation();
    openCart();
  }

  function addItem(payload) {
    addItems([payload]);
  }

  function baseAddToCartPayload(button) {
    return {
      id: button.dataset.cartProductId || button.dataset.cartId,
      productId: button.dataset.cartProductId || button.dataset.cartId,
      brand: button.dataset.cartBrand,
      name: button.dataset.cartName,
      price: Number(button.dataset.cartPrice || 0),
      currency: button.dataset.cartCurrency || "USD",
      image: button.dataset.cartImage,
      variantId: button.dataset.cartVariantId || "",
      sku: button.dataset.cartSku || "",
      selectedOptions: parseDatasetJson(button.dataset.cartSelectedOptions, {}),
      variant: button.dataset.cartVariant || "",
    };
  }

  function resolveButtonVariantPayload(button, product, basePayload) {
    if (!button || !product) return basePayload;

    var variant = null;
    var selects = button.hasAttribute("data-pdp-add-button")
      ? Array.from(document.querySelectorAll("[data-pdp-variant]"))
      : [];
    if (selects.length) {
      var values = selects.map(function (select) {
        return String(select.value || "").trim();
      });
      if (values.every(Boolean)) {
        variant = findVariantBySelectedValues(product, values);
      } else {
        return null;
      }
    } else {
      variant = defaultVariantRecord(product);
    }

    if (!variant) return basePayload;
    var selectedOptions = normalizeVariantSelectedOptions(variant);
    var variantLabel = selectedOptionsLabel(selectedOptions) || String(variant.title || "").trim();
    var price = variantPriceValue(variant) || Number(basePayload.price || 0);
    return {
      id: product.id,
      productId: product.id,
      brand: product.brand || basePayload.brand,
      name:
        button.hasAttribute("data-pdp-add-button") && variantLabel
          ? String(product.name || basePayload.name || "").trim() + " - " + variantLabel
          : product.name || basePayload.name,
      price: price,
      currency: variant.currency || product.currency || basePayload.currency || "USD",
      image: variantImageUrl(variant) || product.image || basePayload.image,
      variantId: String(variant.variant_id || "").trim(),
      sku: String(variant.sku || product.sku || basePayload.sku || "").trim(),
      selectedOptions: selectedOptions,
      variant: variantLabel,
      quantity: basePayload.quantity,
    };
  }

  function addToCartFromButton(button) {
    var payload = baseAddToCartPayload(button);
    var hasResolvedVariant =
      String(payload.variantId || "").trim() ||
      Object.keys(payload.selectedOptions || {}).length > 0;
    if (hasResolvedVariant || !payload.productId) {
      addItem(payload);
      return;
    }

    fetchLiveCatalogProducts([payload.productId]).then(function (products) {
      var resolvedPayload = payload;
      if (products[0]) {
        resolvedPayload = resolveButtonVariantPayload(button, products[0], payload) || null;
      }
      if (resolvedPayload) addItem(resolvedPayload);
    });
  }

  function updateCartItem(id, delta) {
    const item = cart.find((cartItem) => cartItem.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter((cartItem) => cartItem.id !== id);
    }
    saveCart();
    queueCartValidation();
  }

  function removeCartItem(id) {
    cart = cart.filter((cartItem) => cartItem.id !== id);
    saveCart();
    queueCartValidation();
  }

  async function submitCheckout(email) {
    const session = getStoredAuthSession();
    const sessionEmail =
      session && session.user && session.user.email ? session.user.email : "";
    // When signed in, the server trusts the token identity over body.email,
    // so send the account email to keep the client display consistent.
    const effectiveEmail = sessionEmail || email;
    const snapshot = buildCartValidationSnapshot();
    await queueCartValidation({ force: true, delay: false });
    const payload = {
      email: effectiveEmail,
      cart: snapshot,
      attribution: captureAttribution(),
    };

    const headers = {
      "Content-Type": "application/json",
    };
    if (session && session.access_token) {
      headers.Authorization = "Bearer " + session.access_token;
    }

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Could not start checkout.";
      // Read the body exactly once, then try to parse it. Calling json() and
      // then text() on the same response throws "body already read" and masks
      // the real error.
      const raw = await response.text().catch(() => "");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          message = parsed.message || message;
        } catch {
          message = raw;
        }
      }
      throw new Error(message);
    }

    return response.json();
  }

  function showCheckoutNoticeFromUrl() {
    if (!checkoutStatus) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") {
      const reference = params.get("order_reference");
      setFormStatus(
        checkoutStatus,
        reference
          ? "Checkout was cancelled. Your cart is still here. Reference: " + reference
          : "Checkout was cancelled. Your cart is still here.",
        "error"
      );
      openCart();
    }
  }

  document.addEventListener("click", (event) => {
    const quickAddButton = event.target.closest("[data-quick-add]");
    if (quickAddButton) {
      event.preventDefault();
      const card = quickAddButton.closest("[data-product-id]");
      const productId =
        quickAddButton.dataset.productId ||
        (card && card.getAttribute("data-product-id")) ||
        "";
      const productHref =
        quickAddButton.dataset.productHref ||
        quickAddButton.getAttribute("href") ||
        (card && $(".product-card-link", card)
          ? $(".product-card-link", card).getAttribute("href")
          : "");
      openQuickAdd(productId, productHref, quickAddButton);
      return;
    }

    const closeButton = event.target.closest(
      "[data-cart-close], [data-account-close]"
    );
    if (closeButton) closePanels();

    const signOutButton = event.target.closest("[data-account-signout]");
    if (signOutButton) {
      event.preventDefault();
      signOutFromPanel();
      return;
    }

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
      // Card and PDP buttons share the same data attributes; disabled PDP
      // variant buttons are ignored until their required options are selected.
      if (!addButton.disabled && addButton.dataset.cartId) {
        addToCartFromButton(addButton);
      }
    }

    const incrementButton = event.target.closest("[data-cart-increment]");
    if (incrementButton)
      updateCartItem(incrementButton.dataset.cartIncrement, 1);

    const decrementButton = event.target.closest("[data-cart-decrement]");
    if (decrementButton)
      updateCartItem(decrementButton.dataset.cartDecrement, -1);

    const removeButton = event.target.closest("[data-cart-remove]");
    if (removeButton) removeCartItem(removeButton.dataset.cartRemove);
  });

  cartOpenButtons.forEach((button) =>
    button.addEventListener("click", () => openCart(button))
  );

  accountOpenButtons.forEach((button) =>
    button.addEventListener("click", () => openAccount(button))
  );

  // Responsive department menu: the hamburger toggles `.department-nav` on
  // narrow viewports. Accessible via keyboard and reflects state in aria-expanded.
  const navToggle = $("[data-nav-toggle]");
  const departmentNav = $("[data-department-nav]");
  if (navToggle && departmentNav) {
    const setNavOpen = (open) => {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute(
        "aria-label",
        open ? "Close department menu" : "Open department menu"
      );
      departmentNav.classList.toggle("is-open", open);
    };
    navToggle.addEventListener("click", () => {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      setNavOpen(!open);
    });
    departmentNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setNavOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setNavOpen(false);
    });
  }

  // Mobile categories has its own panel so the bottom navigation does not
  // alter or scroll the desktop/header department bar.
  document.addEventListener("click", (event) => {
    const combatSummary = event.target.closest(".department-submenu > summary");
    if (combatSummary && window.matchMedia("(max-width: 760px)").matches) {
      event.preventDefault();
      const submenu = combatSummary.closest(".department-submenu");
      if (submenu) submenu.open = false;
      showMobileCategories(combatSummary, combatSummary.textContent);
      return;
    }
    const categoriesLink = event.target.closest("[data-mobile-categories]");
    if (!categoriesLink) return;
    event.preventDefault();
    showMobileCategories(categoriesLink);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawerOverlay && !drawerOverlay.hidden) {
      closePanels();
    }
  });

  if (drawerOverlay) drawerOverlay.addEventListener("click", closePanels);

  if (accountForm) {
    accountForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = String(new FormData(accountForm).get("email") || "").trim();
      storageSet(GUEST_EMAIL_KEY, email);
      hydrateEmailFields();
      setFormStatus(
        accountStatus,
        "Email saved for guest checkout.",
        "success"
      );
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(
        new FormData(checkoutForm).get("email") || ""
      ).trim();
      if (cart.length === 0) {
        setFormStatus(
          checkoutStatus,
          "Add at least one product before checkout.",
          "error"
        );
        return;
      }
      storageSet(GUEST_EMAIL_KEY, email);
      hydrateEmailFields();
      checkoutBusy = true;
      if (checkoutSubmit) checkoutSubmit.disabled = true;
      setFormStatus(checkoutStatus, checkoutCopy().pending, "pending");
      try {
        const checkout = await submitCheckout(email);
        storageSet(
          LAST_ORDER_REFERENCE_KEY,
          checkout.order_reference || ""
        );
        if (checkout.order) {
          storageSet(
            LAST_TRANSFER_ORDER_KEY,
            JSON.stringify({
              ...checkout.order,
              sales_email: checkout.sales_email || "orders@athletonic.com",
              customer_email_sent: checkout.customer_email_sent !== false,
            })
          );
        } else {
          storageRemove(LAST_TRANSFER_ORDER_KEY);
        }
        cart = [];
        saveCart();
        setFormStatus(
          checkoutStatus,
          "Opening secure checkout...",
          "success"
        );
        window.location.assign(checkout.url);
      } catch (error) {
        console.error(error);
        checkoutBusy = false;
        renderCart();
        setFormStatus(
          checkoutStatus,
          error.message || "Could not place the order. Your cart is still saved here.",
          "error"
        );
      }
    });
  }

  hydrateEmailFields();
  applyCheckoutLabels();
  renderCart();
  queueCartValidation({ force: true });
  showCheckoutNoticeFromUrl();

  window.addEventListener("storage", (event) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      cart = loadCart();
      queueCartValidation({ force: true });
    }
    if (
      event.key === GUEST_EMAIL_KEY ||
      event.key === SB_SESSION_KEY ||
      event.key === null
    ) {
      hydrateEmailFields();
    }
  });

  // Footer: back-to-top
  const backToTopBtn = $("[data-back-to-top]");
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Footer: newsletter signup
  const newsletterForm = $("[data-footer-newsletter]");
  const newsletterStatus = $("[data-footer-newsletter-status]");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(newsletterForm);
      if ((formData.get("company") || "").toString().trim() !== "") return;
      const email = (formData.get("email") || "").toString().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        if (newsletterStatus) {
          newsletterStatus.textContent = "Please enter a valid email.";
          newsletterStatus.dataset.state = "error";
        }
        return;
      }

      if (newsletterStatus) {
        newsletterStatus.textContent = "Submitting...";
        newsletterStatus.dataset.state = "pending";
      }

      try {
        const response = await fetch("/api/newsletter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            company: (formData.get("company") || "").toString(),
            source: "footer",
            page: window.location.pathname,
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "We could not save your email right now.");
        }

        if (newsletterStatus) {
          newsletterStatus.textContent =
            data.message || "Thanks - you're on the list.";
          newsletterStatus.dataset.state = "success";
        }
        newsletterForm.reset();
      } catch (error) {
        if (newsletterStatus) {
          newsletterStatus.textContent =
            error.message || "We could not save your email right now.";
          newsletterStatus.dataset.state = "error";
        }
      }
    });
  }

  // Public API used by PDP-specific code.
  window.AthletonicCart = {
    addItem,
    addItems,
    openCart,
    clear() {
      cart = [];
      saveCart();
      queueCartValidation({ force: true });
    },
    formatMoney,
    refreshVisibleCatalogCards,
    initEmptyInlinePdpController,
  };
})();

/* ── PDP recommendations ──────────────────────────────────────────────────
   Recommendations are always sourced from the active published catalog, so
   removed brands and stale static cards cannot reappear on product pages. */
(function () {
  "use strict";

  var activeBrands = new Set([
    "Boon", "Fairtex", "Manta Sleep", "MuscleTech", "Nike", "Ghost Nutrition",
    "GHOST", "Optimum Nutrition", "Primo", "Raja Boxing", "Schiek",
    "Shock Doctor", "Top King", "Twins Special", "Windy"
  ]);
  var recommendationBrandOrder = [
    "Twins Special", "Top King", "Boon", "Fairtex", "Raja Boxing", "Primo",
    "Windy", "Optimum Nutrition", "MuscleTech", "Ghost Nutrition", "GHOST",
    "Schiek", "Shock Doctor", "Manta Sleep", "Nike"
  ];

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function productType(product) {
    var text = [product.name, product.search, product.section_id, product.section_title, product.category_text].join(" ").toLowerCase();
    if (/heavy\s*bags?|sandbags?|banana\s*bag/.test(text)) return "heavy-bags";
    if (/shin\s*guards?|shinguards?/.test(text)) return "shin-guards";
    if (/\bgloves?\b|bag\s*mitts?/.test(text)) return "gloves";
    if (/\bshorts?\b/.test(text)) return "shorts";
    if (/pads?|mitts?/.test(text)) return "pads";
    if (/t-?shirts?|singlets?|tank\s*tops?|sauna\s*suits?|apparel/.test(text)) return "apparel";
    return String(product.section_id || product.section_title || product.category_text || "other").toLowerCase();
  }

  function diversePicks(products, limit) {
    var byBrand = new Map();
    products.forEach(function (product) {
      var brand = product.brand || "Other";
      if (!byBrand.has(brand)) byBrand.set(brand, []);
      byBrand.get(brand).push(product);
    });
    var brands = Array.from(byBrand.keys()).sort(function (a, b) {
      var ai = recommendationBrandOrder.indexOf(a);
      var bi = recommendationBrandOrder.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
    });
    var picks = [];
    while (picks.length < limit && brands.length) {
      brands.slice().forEach(function (brand) {
        if (picks.length >= limit) return;
        var next = byBrand.get(brand).shift();
        if (next) picks.push(next);
        if (!byBrand.get(brand).length) brands.splice(brands.indexOf(brand), 1);
      });
    }
    return picks;
  }

  function renderRelated() {
    var section = document.querySelector(".pdp-related");
    if (!section) return;

    var row = section.querySelector("[data-active-related-row], .product-row");
    var addButton = document.querySelector("[data-add-to-cart]");
    var title = (document.querySelector("[data-pdp-title]") || {}).textContent || "";
    if (!row || !addButton) return;

    section.hidden = true;
    row.innerHTML = "";
    var currentId = addButton.dataset.cartId || "";
    fetch("../data/final/catalog.published.json", { cache: "no-store" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (catalog) {
        var products = catalog && Array.isArray(catalog.products) ? catalog.products : [];
        var current = products.find(function (product) { return product.id === currentId; }) || { name: title };
        var currentType = productType(current);
        var eligible = products.filter(function (product) {
          return activeBrands.has(product.brand) && product.id !== currentId && product.url && product.image && Number(product.price_cents) > 0;
        });
        var sameType = eligible.filter(function (product) { return productType(product) === currentType; });
        var picks = diversePicks(sameType.length ? sameType : eligible, 4);
        if (!picks.length) return;

        row.innerHTML = picks.map(function (product) {
          var priceCents = Number(product.price_cents) || 0;
          var compareCents = Number(product.compare_at_price_cents) || 0;
          var price = (priceCents / 100).toFixed(2);
          var url = ".." + product.url;
          var offer = compareCents > priceCents
            ? '<s class="product-compare-price">$' + (compareCents / 100).toFixed(2) + '</s>'
            : "";
          var offerBadge = compareCents > priceCents
            ? '<span class="deal-pct">Offer</span>'
            : "";
          return '<article class="product-card">' +
            '<a class="product-image" href="' + escapeHtml(url) + '"><img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" /></a>' +
            '<div class="product-body"><span>' + escapeHtml(product.brand) + '</span>' +
            '<h3><a class="product-card-link" href="' + escapeHtml(url) + '">' + escapeHtml(product.name) + '</a></h3>' +
            '<p>' + escapeHtml(product.section_title || product.category_text || "Training gear") + '</p>' +
            '<div class="product-price-line">' + offer + '<strong>$' + price + '</strong>' + offerBadge + '</div>' +
            '<a class="add-cart-button product-options-button" href="' + escapeHtml(url) + '">View options</a></div></article>';
        }).join("");
        section.hidden = false;
      })
      .catch(function () { row.innerHTML = ""; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderRelated);
  } else {
    renderRelated();
  }
})();

/* ============================================================
 *  Athletonic Live Search  —  self-contained module
 *  Appended to cart.js so it runs on every page automatically.
 * ============================================================ */
(function () {
  "use strict";

  var RECENT_KEY  = "ath-recent-searches-v1";
  var MAX_RESULTS = 1200;
  var DROPDOWN_MAX_RESULTS = 8;
  var MAX_RECENT  = 5;
  var DEBOUNCE_MS = 80;
  var formCounter = 0;

  var TRENDING = [
    { label: "Twins Special gloves", q: "Twins Special gloves", category: "all" },
    { label: "Muay Thai shorts", q: "Muay Thai shorts", category: "all" },
    { label: "Top King", q: "Top King", category: "all" },
    { label: "Shin guards", q: "shin guards", category: "all" },
    { label: "Thai pads", q: "Thai pads", category: "all" },
    { label: "Heavy bags", q: "heavy bags", category: "all" },
    { label: "Creatine monohydrate", q: "creatine", category: "creatine" },
    { label: "Whey protein", q: "whey protein", category: "protein" },
  ];

  /* ── Path helpers ── */
  /* Resolve data files relative to THIS script's own URL so they work at any
     directory depth (root, /pages/, /product/, and the localized /es/ tree,
     which has no /es/data/ copy). Falls back to the pathname heuristic. */
  var SCRIPT_ROOT = (function () {
    var el =
      document.currentScript ||
      document.querySelector('script[src*="assets/cart.js"]');
    return el && el.src ? el.src.replace(/assets\/cart\.js.*$/, "") : null;
  })();
  function isProductOrPages() {
    return /\/(product|pages)\//.test(window.location.pathname);
  }
  function baseHref() {
    return isProductOrPages() ? "../" : "./";
  }
  function publicProductSlug(id) {
    return normalizeCatalogProductId(id)
      .replace(/^official-/, "")
      .replace(/^(raja|twins|fairtex|boon|topking|primo|yokkao)-\1-/, "$1-");
  }
  function productPdpHref(product) {
    return baseHref() + "product/" + encodeURIComponent(publicProductSlug(product && product.id));
  }
  function primaryProductHref(product) {
    if (
      product &&
      product.external_only === true &&
      product.has_pdp === false &&
      product.url
    ) {
      return product.url;
    }
    return productPdpHref(product);
  }
  function dataRoot() {
    return SCRIPT_ROOT || baseHref();
  }
  function catalogUrl() {
    return dataRoot() + "data/final/catalog.published.json";
  }
  function isHome() {
    var p = window.location.pathname;
    return p === "/" || p === "" || p.endsWith("/index.html");
  }
  function isCatalogPage() {
    return /(?:^|\/)(?:catalog|pages\/catalog(?:\.html)?)$/.test(
      window.location.pathname
    );
  }

  /* ── Catalog load (cached) ── */
  var _catalog = null;
  var _catalogReq = null;
  function isTemporarilyHiddenCatalogProduct(product) {
    var brand = String((product && (product.brand_slug || product.brand)) || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return brand === "yokkao";
  }
  function loadCatalog() {
    if (_catalog) return Promise.resolve(_catalog);
    if (_catalogReq) return _catalogReq;
    _catalogReq = fetch(catalogUrl())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        _catalog = (d.products || []).filter(function (product) {
          return !isTemporarilyHiddenCatalogProduct(product);
        });
        return _catalog;
      })
      .catch(function () { _catalog = []; return _catalog; });
    return _catalogReq;
  }

  /* ── Full search index load (cached) ──
     The catalog RESULTS page searches this lightweight index of the broad
     active/US/official-source catalog. The dropdown still uses the curated
     athletonic-catalog.json preview set. */
  function searchIndexUrl() {
    return dataRoot() + "data/final/search-index.published.json";
  }
  var _searchIndex = null;
  var _searchIndexReq = null;
  var _searchIndexError = false;
  var _searchApiBroken = false;
  function loadSearchIndex() {
    if (_searchIndex) return Promise.resolve(_searchIndex);
    if (_searchIndexReq) return _searchIndexReq;
    _searchIndexReq = Promise.all([
      fetch(searchIndexUrl()).then(function (r) {
        if (!r.ok) throw new Error("search index HTTP " + r.status);
        return r.json();
      }),
      loadCatalog(),
    ])
      .then(function (results) {
        var indexData = results[0] || {};
        var catalogProducts = Array.isArray(results[1]) ? results[1] : [];
        var catalogById = new Map(
          catalogProducts.map(function (product) {
            return [normalizeCatalogProductId(product && product.id), product];
          }).filter(function (entry) { return entry[0]; })
        );
        _searchIndexError = false;
        _searchIndex = (indexData.products || []).map(function (product) {
          var richProduct = catalogById.get(normalizeCatalogProductId(product && product.id));
          return richProduct ? Object.assign({}, richProduct, product) : product;
        }).filter(function (product) {
          return !isTemporarilyHiddenCatalogProduct(product);
        });
        return _searchIndex;
      })
      .catch(function () {
        /* Don't cache the failure: clear the in-flight promise so the next
           keystroke retries, and flag the error so the UI can say "search
           unavailable" instead of a misleading "No results". */
        _searchIndexReq = null;
        _searchIndexError = true;
        return [];
      });
    return _searchIndexReq;
  }

  /* Friendly category labels for index records (which omit section_title). */
  var SECTION_LABELS = {
    protein: "Protein",
    creatine: "Creatine",
    "pre-workout": "Pre-workout",
    hydration: "Hydration",
    vitamins: "Daily health",
    greens: "Greens",
    "bars-shakes": "Bars & shakes",
    recovery: "Recovery",
    sleep: "Sleep recovery",
    apparel: "Training apparel",
    shoes: "Training footwear",
    accessories: "Gym accessory",
    "training-gear": "Training gear",
  };
  var BRAND_LABEL_OVERRIDES = {
    azteca_soccer: "Azteca Soccer",
    beekeepers_naturals: "Beekeeper's Naturals",
    black_magic_supps: "Black Magic Supps",
    dose_and_co: "Dose & Co",
    fifa_store: "FIFA Store",
    football_town: "Football Town",
    fuji_sports: "Fuji Sports",
    golaco_kits: "Golaco Kits",
    jshealth_vitamins: "JSHealth Vitamins",
    love_wellness: "Love Wellness",
    magic_mind: "Magic Mind",
    moon_juice: "Moon Juice",
    navitas_organics: "Navitas Organics",
    nested_naturals: "Nested Naturals",
    novos_labs: "Novos Labs",
    o_positiv: "O Positiv",
    performance_lab: "Performance Lab",
    rae_wellness: "Rae Wellness",
    rdx_sports: "RDX Sports",
    rival_boxing: "Rival Boxing",
    ryse_supplements: "RYSE Supplements",
    shock_doctor: "Shock Doctor",
    soccer_post: "Soccer Post",
    soccer_zone_usa: "Soccer Zone USA",
    the_nue_co: "The Nue Co",
    tru_niagen: "Tru Niagen",
    twins_special: "Twins Special",
    winged_wellness: "Winged Wellness",
  };
  function normalizeCatalogProductId(value) {
    var raw = String(value || "").trim();
    return raw ? String(raw.split("::")[0] || "").trim() : "";
  }
  function normalizeCatalogSelectedOptions(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    var out = {};
    Object.keys(value).sort().forEach(function (key) {
      var cleanKey = String(key || "").trim();
      var cleanValue = String(value[key] || "").trim();
      if (cleanKey && cleanValue) out[cleanKey] = cleanValue;
    });
    return out;
  }
  function selectedCatalogOptionsLabel(options) {
    return Object.keys(options || {})
      .map(function (key) { return key + ": " + options[key]; })
      .join(" / ");
  }
  function catalogVariantRecords(product) {
    return Array.isArray(product && product.variants) ? product.variants : [];
  }
  function catalogVariantSelectedOptions(variant) {
    return normalizeCatalogSelectedOptions(
      variant && (variant.selected_options || variant.selectedOptions)
    );
  }
  function findCatalogVariant(product, variantId) {
    var cleanVariantId = String(variantId || "").trim();
    if (!cleanVariantId) return null;
    return (
      catalogVariantRecords(product).find(function (variant) {
        return String((variant && variant.variant_id) || "").trim() === cleanVariantId;
      }) || null
    );
  }
  function defaultCatalogVariant(product) {
    return (
      findCatalogVariant(product, product && product.default_variant_id) ||
      catalogVariantRecords(product)[0] ||
      null
    );
  }
  function catalogVariantImageUrl(variant) {
    return String(
      (variant && (variant.image_url || variant.image || variant.featured_image)) || ""
    ).trim();
  }
  function catalogVariantPriceValue(variant) {
    var cents = Number((variant && (variant.price_cents || variant.priceCents)) || 0);
    if (Number.isFinite(cents) && cents > 0) return cents / 100;
    var price = Number((variant && variant.price) || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  }
  function catalogVariantCompareAtValue(variant, price) {
    var cents = Number(
      (variant && (variant.compare_at_price_cents || variant.compareAtPriceCents)) || 0
    );
    if (Number.isFinite(cents) && cents > 0) {
      var compare = cents / 100;
      return compare > price ? compare : null;
    }
    var compare = Number(
      (variant && (variant.compare_at_price || variant.compareAtPrice)) || 0
    );
    return Number.isFinite(compare) && compare > price ? compare : null;
  }
  function directCatalogVariantData(product) {
    var variant = defaultCatalogVariant(product);
    var price = catalogVariantPriceValue(variant);
    if (!variant) return null;

    var selectedOptions = catalogVariantSelectedOptions(variant);
    return {
      variantId: String(variant.variant_id || "").trim(),
      selectedOptions: selectedOptions,
      variant: selectedCatalogOptionsLabel(selectedOptions),
      image: catalogVariantImageUrl(variant),
      price: price,
      compareAtPrice: catalogVariantCompareAtValue(variant, price),
      currency: String(variant.currency || product && product.currency || "").trim(),
    };
  }
  function sectionLabel(p) {
    return p.section_title || SECTION_LABELS[p.section_id] || "";
  }
  function categoryLabel(category) {
    if (!category || category === "all") return "";
    return SECTION_LABELS[category] || String(category).replace(/-/g, " ");
  }
  function titleCaseToken(token) {
    var upper = {
      co: "Co",
      fifa: "FIFA",
      jshealth: "JSHealth",
      rdx: "RDX",
      usa: "USA",
      ryse: "RYSE",
    };
    var lower = String(token || "").toLowerCase();
    if (upper[lower]) return upper[lower];
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  function displayLabel(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var key = raw.toLowerCase();
    if (BRAND_LABEL_OVERRIDES[key]) return BRAND_LABEL_OVERRIDES[key];
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map(titleCaseToken)
      .join(" ");
  }
  function displayBrand(productOrBrand) {
    var raw = typeof productOrBrand === "string"
      ? productOrBrand
      : (productOrBrand && (productOrBrand.brand || productOrBrand.brand_slug)) || "";
    return displayLabel(raw);
  }
  function normalizeVisibleBrandLabels(root) {
    var scope = root || document;
    [".pdp-brand", ".product-body > span", ".sdd-brand"].forEach(function (selector) {
      scope.querySelectorAll(selector).forEach(function (node) {
        var clean = displayBrand(node.textContent);
        if (clean) node.textContent = clean;
      });
    });
    scope.querySelectorAll("dt").forEach(function (dt) {
      if (String(dt.textContent || "").trim().toLowerCase() !== "brand") return;
      var dd = dt.nextElementSibling;
      if (!dd) return;
      var clean = displayBrand(dd.textContent);
      if (clean) dd.textContent = clean;
    });
    scope.querySelectorAll("[data-cart-brand]").forEach(function (node) {
      var clean = displayBrand(node.getAttribute("data-cart-brand"));
      if (clean) node.setAttribute("data-cart-brand", clean);
    });
    if (document.title) {
      Object.keys(BRAND_LABEL_OVERRIDES).forEach(function (slug) {
        document.title = document.title.replace(new RegExp(slug, "gi"), BRAND_LABEL_OVERRIDES[slug]);
      });
    }
  }

  /* ── Utils ── */
  function fmtPrice(cents) {
    return "$" + (cents / 100).toFixed(2);
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function highlight(text, q) {
    if (!q) return esc(text);
    var rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return esc(text).replace(rx, "<mark>$1</mark>");
  }
  function normalizeSearchText(value) {
    var text = String(value || "").toLowerCase();
    try {
      text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) { /* older engines without String.normalize */ }
    return text.replace(/[^a-z0-9]+/g, " ").trim();
  }
  function catalogOptionValuesText(values) {
    return Array.isArray(values)
      ? values
          .map(function (entry) {
            return entry && (entry.value || entry.selected_value || entry.label || "");
          })
          .filter(Boolean)
          .join(" ")
      : "";
  }
  function catalogProductUrlSlug(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var clean = raw.split("?")[0].split("#")[0];
    var slug = clean.split("/").pop() || "";
    return slug.replace(/\.html?$/i, "");
  }
  function uniqueCatalogSearchValues(values) {
    var seen = {};
    var out = [];
    values.forEach(function (value) {
      var normalized = normalizeSearchText(value);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      out.push(normalized);
    });
    return out;
  }
  function productSearchMeta(p) {
    if (!p._athSearchMeta) {
      var variantTerms = [];
      catalogVariantRecords(p).forEach(function (variant) {
        variantTerms.push(
          variant && variant.variant_id,
          variant && variant.sku,
          variant && variant.title,
          catalogOptionValuesText(variant && variant.option_values),
          catalogOptionValuesText(
            variant && variant.selected_options
              ? Object.keys(variant.selected_options).map(function (name) {
                  return { name: name, value: variant.selected_options[name] };
                })
              : []
          )
        );
      });
      var identifiers = uniqueCatalogSearchValues([
        p.id,
        p.external_product_id,
        p.sku,
        p.default_variant_id,
        p.url,
        catalogProductUrlSlug(p.url),
      ].concat(variantTerms));
      p._athSearchMeta = {
        name: normalizeSearchText(p.name),
        brand: normalizeSearchText(p.brand || p.brand_slug),
        nameWords: normalizeSearchText(p.name).split(" ").filter(Boolean),
        brandWords: normalizeSearchText(p.brand || p.brand_slug).split(" ").filter(Boolean),
        identifiers: identifiers,
        identifierCompacts: identifiers.map(function (value) {
          return value.replace(/ /g, "");
        }),
      };
    }
    return p._athSearchMeta;
  }
  function queryTokens(q) {
    var seen = {};
    return normalizeSearchText(q)
      .split(/\s+/)
      .filter(function (token) { return token && (token.length > 1 || /\d/.test(token)); })
      .filter(function (token) {
        if (seen[token]) return false;
        seen[token] = true;
        return true;
      });
  }
  /* Cached normalized search blobs per product: `text` (space separated) and
     `squashed` (no spaces) so compound-word queries match in both directions
     ("shinguards" ↔ "shin guards", "muscle tech" ↔ "muscletech"). */
  function productSearchBlobs(p) {
    if (!p._athSearchBlobs) {
      var meta = productSearchMeta(p);
      var text = uniqueCatalogSearchValues([
        p.search,
        p.name,
        p.brand,
        displayBrand(p),
        p.section_title,
        sectionLabel(p),
        p.section_id,
      ].concat(meta.identifiers)).join(" ");
      p._athSearchBlobs = { text: text, squashed: text.replace(/ /g, ""), words: null };
    }
    return p._athSearchBlobs;
  }
  function productSearchText(p) {
    return productSearchBlobs(p).text;
  }
  function tokenVariants(token) {
    /* Singular/plural tolerance: "glove" ↔ "gloves", "guard" ↔ "guards". */
    var variants = [token];
    if (token.length > 3 && token.charAt(token.length - 1) === "s") {
      variants.push(token.slice(0, -1));
    }
    return variants;
  }
  function tokenInBlobs(blobs, token) {
    var variants = tokenVariants(token);
    for (var i = 0; i < variants.length; i++) {
      if (
        blobs.text.indexOf(variants[i]) !== -1 ||
        blobs.squashed.indexOf(variants[i]) !== -1
      ) {
        return true;
      }
    }
    return false;
  }
  /* One-edit typo tolerance (insert/delete/substitute/transpose) for longer tokens. */
  function tokenAlmostMatchesWord(token, word) {
    var tl = token.length;
    var wl = word.length;
    if (Math.abs(tl - wl) > 1) return false;
    var i = 0;
    var j = 0;
    var edits = 0;
    while (i < tl && j < wl) {
      if (token.charAt(i) === word.charAt(j)) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (
        tl === wl &&
        i + 1 < tl && j + 1 < wl &&
        token.charAt(i) === word.charAt(j + 1) &&
        token.charAt(i + 1) === word.charAt(j)
      ) {
        /* Adjacent transposition counts as a single edit. */
        i += 2;
        j += 2;
      } else if (tl > wl) i++;
      else if (wl > tl) j++;
      else { i++; j++; }
    }
    return edits + (tl - i) + (wl - j) <= 1;
  }
  function fuzzyTokenInBlobs(blobs, token) {
    if (token.length < 5) return false;
    if (!blobs.words) blobs.words = blobs.text.split(" ");
    for (var i = 0; i < blobs.words.length; i++) {
      if (tokenAlmostMatchesWord(token, blobs.words[i])) return true;
    }
    return false;
  }
  function matchesProductQuery(p, lq, tokens) {
    if (!lq) return true;
    var blobs = productSearchBlobs(p);
    if (blobs.text.indexOf(lq) !== -1) return true;
    var squashedQuery = lq.replace(/ /g, "");
    if (squashedQuery && blobs.squashed.indexOf(squashedQuery) !== -1) return true;
    return tokens.length > 0 && tokens.every(function (token) {
      return tokenInBlobs(blobs, token);
    });
  }
  function scoreCatalogProduct(p, lq, tokens) {
    var meta = productSearchMeta(p);
    var n = meta.name;
    var b = meta.brand;
    var displayB = normalizeSearchText(displayBrand(p));
    var label = (sectionLabel(p) || "").toLowerCase();
    var section = String(p.section_id || "").toLowerCase();
    var haystack = productSearchText(p);
    var compactQuery = lq.replace(/ /g, "");
    var score = scoreProduct(p, lq);

    if (!lq) return score;
    if (meta.identifiers.indexOf(lq) !== -1) score += 400;
    else if (compactQuery && meta.identifierCompacts.indexOf(compactQuery) !== -1) score += 360;
    else if (
      compactQuery &&
      compactQuery.length >= 5 &&
      meta.identifierCompacts.some(function (value) { return value.indexOf(compactQuery) === 0; })
    ) {
      score += 260;
    } else if (
      compactQuery.length >= 5 &&
      meta.identifiers.some(function (value) { return value.indexOf(lq) !== -1; })
    ) {
      score += 180;
    }
    if (n === lq) score += 20;
    else if (n.startsWith(lq)) score += 12;
    if (meta.nameWords.indexOf(lq) !== -1) score += 18;
    if (b === lq || displayB === lq) score += 18;
    else if ((b && b.indexOf(lq) === 0) || (displayB && displayB.indexOf(lq) === 0)) score += 12;
    if (meta.brandWords.indexOf(lq) !== -1) score += 12;
    if (label === lq || section === lq) score += 6;
    if (haystack.indexOf(lq) !== -1) score += 4;

    tokens.forEach(function (token) {
      var compactToken = token.replace(/ /g, "");
      if (
        meta.identifiers.indexOf(token) !== -1 ||
        meta.identifierCompacts.indexOf(compactToken) !== -1
      ) {
        score += 20;
      } else if (meta.nameWords.indexOf(token) !== -1) score += 6;
      else if (meta.brandWords.indexOf(token) !== -1) score += 4;
      else if (n.indexOf(token) !== -1) score += 3;
      else if (b.indexOf(token) !== -1 || displayB.indexOf(token) !== -1) score += 2;
      else if (label.indexOf(token) !== -1 || section.indexOf(token) !== -1) score += 1;
    });

    return score;
  }

  /* ── Recent searches ── */
  function getRecents() {
    try {
      var d = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(d) ? d.slice(0, MAX_RECENT) : [];
    } catch (e) { return []; }
  }
  function pushRecent(q) {
    q = (q || "").trim();
    if (q.length < 2) return;
    var list = getRecents().filter(function (r) { return r.toLowerCase() !== q.toLowerCase(); });
    list.unshift(q);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch (e) {}
  }
  function removeRecent(q) {
    var list = getRecents().filter(function (r) { return r.toLowerCase() !== q.toLowerCase(); });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ── Product search ── */
  function scoreProduct(p, lq) {
    var n = (p.name  || "").toLowerCase();
    var b = (p.brand || "").toLowerCase();
    if (n.startsWith(lq)) return 4;
    if (b === lq)         return 3;
    if (n.includes(lq))   return 2;
    if (b.includes(lq))   return 1;
    if (displayBrand(p).toLowerCase().includes(lq)) return 1;
    return 0;
  }
  function productHasDisplayPrice(p) {
    return Number(p.price_cents || p.priceCents || 0) > 0 || Number(p.price || 0) > 0;
  }
  function searchProducts(products, q, category) {
    var lq = q.toLowerCase();
    var res = products.filter(function (p) {
      if (!productHasDisplayPrice(p)) return false;
      if (category && category !== "all" && p.section_id !== category) return false;
      if (!lq) return true;
      return (
        (p.name         || "").toLowerCase().includes(lq) ||
        (p.brand        || "").toLowerCase().includes(lq) ||
        (p.section_title|| "").toLowerCase().includes(lq)
      );
    });
    if (lq) res.sort(function (a, b) { return scoreProduct(b, lq) - scoreProduct(a, lq); });
    return res.slice(0, MAX_RESULTS);
  }

  /* ── Catalog page: full-depth filter over the search index ──
     Unlike searchProducts() (which caps results for the dropdown preview), this
     returns ALL matching products and allows category-only filtering. It matches
     against the prebuilt lowercased `search` blob when present (index records),
     falling back to name/brand/section_title for curated records. */
  function filterCatalogFull(products, q, category) {
    var lq = normalizeSearchText(q);
    var tokens = queryTokens(lq);
    var base = products.filter(function (p) {
      if (!productHasDisplayPrice(p)) return false;
      if (category && category !== "all" && p.section_id !== category) return false;
      return true;
    });
    var res = lq
      ? base.filter(function (p) { return matchesProductQuery(p, lq, tokens); })
      : base;
    /* Never dead-end: if strict AND-matching finds nothing, fall back to the
       best partial matches (most tokens matched, with typo tolerance). */
    if (lq && !res.length && tokens.length) {
      var scored = [];
      base.forEach(function (p) {
        var blobs = productSearchBlobs(p);
        var hits = 0;
        tokens.forEach(function (token) {
          if (tokenInBlobs(blobs, token) || fuzzyTokenInBlobs(blobs, token)) hits += 1;
        });
        if (hits > 0) scored.push({ product: p, hits: hits });
      });
      scored.sort(function (a, b) {
        return (
          b.hits - a.hits ||
          scoreCatalogProduct(b.product, lq, tokens) - scoreCatalogProduct(a.product, lq, tokens)
        );
      });
      return scored.slice(0, 400).map(function (entry) { return entry.product; });
    }
    if (lq) {
      res.sort(function (a, b) {
        return scoreCatalogProduct(b, lq, tokens) - scoreCatalogProduct(a, lq, tokens);
      });
    }
    return res;
  }

  /* Build a product card matching the generated markup so the delegated
     add-to-cart handler in the cart module works on these dynamic cards.
     Marketplace records point at generated PDPs. Official/external URLs remain
     reference data unless a record is explicitly marked external-only. */
  function catalogCardHtml(p) {
    var href = primaryProductHref(p);
    var directVariant = directCatalogVariantData(p);
    var price = directVariant && directVariant.price > 0
      ? directVariant.price
      : (Number(p.price_cents) || 0) / 100;
    var priceStr = price.toFixed(2);
    var imageWidth = Number(p.image_width || p.imageWidth || 640) || 640;
    var imageHeight =
      Number(p.image_height || p.imageHeight || imageWidth) || imageWidth;
    var compare = directVariant && directVariant.compareAtPrice
      ? directVariant.compareAtPrice
      : (p.compare_at_price_cents
        ? (Number(p.compare_at_price_cents) || 0) / 100
        : null);
    var currency = (directVariant && directVariant.currency) || p.currency || "USD";
    var brandLabel = displayBrand(p);
    var label = sectionLabel(p);
    var variantOffer = p.variant_offer || null;
    var cardImage = (directVariant && directVariant.image) || p.image || "";
    var directVariantId = directVariant && directVariant.variantId
      ? directVariant.variantId
      : String(p.default_variant_id || "");
    var directSelectedOptions = directVariant ? directVariant.selectedOptions : {};
    var directVariantLabel = directVariant ? directVariant.variant : "";
    var dealNote = "";
    if (variantOffer) {
      dealNote = '<p class="product-deal-note">' +
        esc("Limited offer") +
        "</p>";
    } else if (p.deal) {
      dealNote = '<p class="product-deal-note">' +
        esc("Limited offer") + "</p>";
    }
    var purchasable = productHasDisplayPrice(p);
    var mustChooseOptions = Boolean(p.requires_variant_selection || variantOffer);
    var actionHtml = !purchasable
      ? '<a class="add-cart-button product-options-button" href="' + esc(href) +
          '" aria-label="View ' + esc(p.name || "product") +
        '">View product</a>'
      : mustChooseOptions
        ? '<button class="add-cart-button" type="button" data-quick-add' +
            ' data-product-id="' + esc(p.id) + '"' +
            ' data-product-href="' + esc(href) + '"' +
            ' aria-label="Choose options and add ' + esc(p.name || "product") +
        ' to cart">Add to cart</button>'
        : '<button class="add-cart-button" type="button" data-add-to-cart' +
            ' data-cart-id="' + esc(p.id) + '"' +
            ' data-cart-product-id="' + esc(p.id) + '"' +
            ' data-cart-variant-id="' + esc(directVariantId) + '"' +
            ' data-cart-brand="' + esc(brandLabel || p.brand || "") + '"' +
            ' data-cart-name="' + esc(p.name || "") + '"' +
            ' data-cart-price="' + esc(priceStr) + '"' +
            ' data-cart-price-cents="' + esc(String(Math.round(price * 100))) + '"' +
            ' data-cart-currency="' + esc(currency) + '"' +
            ' data-cart-image="' + esc(cardImage) + '"' +
            ' data-cart-selected-options="' + esc(JSON.stringify(directSelectedOptions)) + '"' +
            ' data-cart-variant="' + esc(directVariantLabel) + '"' +
            ' aria-label="Add ' + esc(p.name || "product") + ' to cart"' +
          '>Add to cart</button>';
    return (
      '<article class="product-card" data-product-id="' + esc(p.id) +
        '" data-category="' + esc(p.section_id || "") + '">' +
        '<a class="product-image" href="' + esc(href) + '">' +
          '<img src="' + esc(cardImage) + '" alt="' + esc(p.name || "") +
            '" width="' + esc(imageWidth) + '" height="' + esc(imageHeight) +
            '" loading="lazy" decoding="async" />' +
        '</a>' +
        '<div class="product-body">' +
          '<span>' + esc(brandLabel || p.brand || "") + '</span>' +
          '<h3><a class="product-card-link" href="' + esc(href) + '">' +
            esc(p.name || "") + '</a></h3>' +
          '<p>' + esc(label) + '</p>' +
          '<div class="product-price-line">' +
            '<strong>$' + esc(priceStr) + '</strong>' +
            (compare ? '<span>$' + compare.toFixed(2) + '</span>' : "") +
          '</div>' +
          dealNote +
          actionHtml +
        '</div>' +
      '</article>'
    );
  }

  /* Keep the catalog page URL in sync with the active query/category. */
  function updateCatalogUrl(q, category) {
    var params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category && category !== "all") params.set("category", category);
    var filters = catalogFilterState();
    ["brand", "color", "size", "min", "max", "sort"].forEach(function (key) {
      if (filters[key] && !(key === "sort" && filters[key] === "relevance")) {
        params.set(key, filters[key]);
      }
    });
    var qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  /* Render the catalog results grid from the full search index, or restore the
     default browse view when there is no active query/category. Results are
     paginated (PAGE_SIZE per chunk) with a "Load more" button so a large match
     set never injects thousands of nodes at once. */
  var CATALOG_PAGE_SIZE = 1200;
  var _catalogBaseMatches = [];
  var _catalogMatches = [];
  var _catalogShown = 0;
  var _loadMoreBtn = null;
  var _catalogLastQuery = "";
  var _catalogLastCategory = "all";

  function ensureLoadMoreButton(resultsEl) {
    if (_loadMoreBtn && _loadMoreBtn.isConnected) return _loadMoreBtn;
    _loadMoreBtn = document.createElement("button");
    _loadMoreBtn.type = "button";
    _loadMoreBtn.className = "catalog-load-more";
    _loadMoreBtn.setAttribute("data-catalog-load-more", "");
    _loadMoreBtn.hidden = true;
    _loadMoreBtn.addEventListener("click", function () {
      renderCatalogChunk(resultsEl);
    });
    resultsEl.parentNode.insertBefore(_loadMoreBtn, resultsEl.nextSibling);
    return _loadMoreBtn;
  }

  function renderCatalogChunk(resultsEl) {
    var next = _catalogMatches.slice(
      _catalogShown,
      _catalogShown + CATALOG_PAGE_SIZE
    );
    resultsEl.insertAdjacentHTML("beforeend", next.map(catalogCardHtml).join(""));
    _catalogShown += next.length;
    normalizeVisibleBrandLabels(resultsEl);
    window.requestAnimationFrame(function () {
      var cartApi = window.AthletonicCart || {};
      if (typeof cartApi.refreshVisibleCatalogCards === "function") {
        cartApi.refreshVisibleCatalogCards();
      }
    });
    var btn = ensureLoadMoreButton(resultsEl);
    var remaining = _catalogMatches.length - _catalogShown;
    if (remaining > 0) {
      btn.hidden = false;
      btn.textContent = "Load more products";
    } else {
      btn.hidden = true;
    }
  }

  function catalogProductPrice(p) {
    var directVariant = directCatalogVariantData(p);
    if (directVariant && directVariant.price > 0) return directVariant.price;
    var cents = Number(p.price_cents || p.priceCents || 0);
    if (Number.isFinite(cents) && cents > 0) return cents / 100;
    var price = Number(p.price || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  }

  function cleanFacetValue(value) {
    return String(value || "").trim();
  }

  function catalogFacetValues(p, key) {
    var values = Array.isArray(p && p[key]) ? p[key] : [];
    return values.map(cleanFacetValue).filter(Boolean);
  }

  function catalogFilterState() {
    var tools = document.querySelector("[data-catalog-tools]");
    var out = { brand: "", color: "", size: "", min: "", max: "", sort: "relevance" };
    if (!tools) return out;
    Object.keys(out).forEach(function (key) {
      var control = tools.querySelector("[data-catalog-filter='" + key + "']");
      if (control) out[key] = cleanFacetValue(control.value);
    });
    return out;
  }

  function setCatalogFilterOptions(selector, values, emptyLabel) {
    var select = document.querySelector("[data-catalog-filter='" + selector + "']");
    if (!select) return;
    var current = select.value;
    var unique = Array.from(new Set(values.map(cleanFacetValue).filter(Boolean)));
    unique.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: "base" }); });
    select.innerHTML = '<option value="">' + esc(emptyLabel) + '</option>' +
      unique.map(function (value) {
        return '<option value="' + esc(value) + '">' + esc(value) + '</option>';
      }).join("");
    if (current && unique.indexOf(current) !== -1) select.value = current;
  }

  function populateCatalogFilters(products) {
    var tools = document.querySelector("[data-catalog-tools]");
    if (!tools) return;
    var brands = [];
    var colors = [];
    var sizes = [];
    products.forEach(function (p) {
      var brand = displayBrand(p);
      if (brand) brands.push(brand);
      colors = colors.concat(catalogFacetValues(p, "available_colors"));
      sizes = sizes.concat(catalogFacetValues(p, "available_sizes"));
    });
    setCatalogFilterOptions("brand", brands, "All brands");
    setCatalogFilterOptions("color", colors, "Any color");
    setCatalogFilterOptions("size", sizes, "Any size");
  }

  function applyCatalogFilterParams() {
    if (!isCatalogPage()) return;
    var params = new URLSearchParams(window.location.search);
    ["brand", "color", "size", "min", "max", "sort"].forEach(function (key) {
      var control = document.querySelector("[data-catalog-filter='" + key + "']");
      var value = params.get(key);
      if (control && value) control.value = value;
    });
  }

  function productMatchesCatalogFilters(p, filters) {
    var price = catalogProductPrice(p);
    if (filters.brand && displayBrand(p).toLowerCase() !== filters.brand.toLowerCase()) {
      return false;
    }
    if (filters.color) {
      var colors = catalogFacetValues(p, "available_colors").map(function (value) { return value.toLowerCase(); });
      if (colors.indexOf(filters.color.toLowerCase()) === -1) return false;
    }
    if (filters.size) {
      var sizes = catalogFacetValues(p, "available_sizes").map(function (value) { return value.toLowerCase(); });
      if (sizes.indexOf(filters.size.toLowerCase()) === -1) return false;
    }
    if (filters.min && price < Number(filters.min)) return false;
    if (filters.max && price > Number(filters.max)) return false;
    return true;
  }

  function sortCatalogMatches(products, sort) {
    if (sort === "price-asc") {
      products.sort(function (a, b) { return catalogProductPrice(a) - catalogProductPrice(b); });
    } else if (sort === "price-desc") {
      products.sort(function (a, b) { return catalogProductPrice(b) - catalogProductPrice(a); });
    } else if (sort === "name-asc") {
      products.sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      });
    }
    return products;
  }

  function renderCatalogFilteredResults() {
    var resultsEl = document.querySelector("[data-catalog-results]");
    if (!resultsEl) return;
    var statusEl = document.querySelector(".search-status");
    var filters = catalogFilterState();
    var activeCategoryLabel = categoryLabel(_catalogLastCategory);
    var matches = _catalogBaseMatches.filter(function (p) {
      return productMatchesCatalogFilters(p, filters);
    });
    _catalogMatches = sortCatalogMatches(matches.slice(), filters.sort);
    _catalogShown = 0;
    resultsEl.hidden = false;
    resultsEl.innerHTML = "";
    if (_catalogMatches.length) {
      renderCatalogChunk(resultsEl);
    } else {
      if (_loadMoreBtn) _loadMoreBtn.hidden = true;
      resultsEl.innerHTML =
        '<div class="catalog-empty">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="8"></circle>' +
            '<line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
          '<p>No results' + (_catalogLastQuery ? ' for <strong>&ldquo;' + esc(_catalogLastQuery) + '&rdquo;</strong>' : "") +
            (activeCategoryLabel ? " in " + esc(activeCategoryLabel) : "") + ".</p>" +
          '<p class="catalog-empty-hint">Try removing a filter or search a broader term.</p>' +
        '</div>';
    }
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent =
        "Showing " + _catalogMatches.length + " of " + _catalogBaseMatches.length + " matching products" +
        (_catalogLastQuery ? ' for "' + _catalogLastQuery + '"' : "") +
        (activeCategoryLabel ? " in " + activeCategoryLabel : "");
    }
  }

  function fetchCatalogSearchPage(q, category, limit, offset) {
    if (_searchApiBroken || typeof fetch !== "function") {
      return Promise.reject(new Error("search api unavailable"));
    }
    var url =
      (SCRIPT_ROOT || "/") +
      "api/catalog/search?q=" + encodeURIComponent(q || "") +
      "&category=" + encodeURIComponent(category || "all") +
      "&limit=" + encodeURIComponent(String(limit)) +
      "&offset=" + encodeURIComponent(String(offset || 0));
    return fetch(url).then(function (r) {
      if (!r.ok) {
        _searchApiBroken = true;
        throw new Error("search api http " + r.status);
      }
      return r.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.products)) {
        _searchApiBroken = true;
        throw new Error("search api bad payload");
      }
      return data;
    });
  }

  function fetchCatalogSearchResults(q, category) {
    var trimmed = String(q || "").trim();
    if (!trimmed) return Promise.resolve([]);
    var pageSize = 50;
    return fetchCatalogSearchPage(trimmed, category, pageSize, 0).then(function (firstPage) {
      var total = Number(firstPage.total || 0);
      var products = Array.isArray(firstPage.products) ? firstPage.products.slice() : [];
      if (products.length >= total || total <= pageSize) return products;

      var tasks = [];
      for (var offset = pageSize; offset < total; offset += pageSize) {
        tasks.push(fetchCatalogSearchPage(trimmed, category, pageSize, offset));
      }
      return Promise.all(tasks).then(function (pages) {
        pages.forEach(function (page) {
          if (page && Array.isArray(page.products)) {
            products = products.concat(page.products);
          }
        });
        return products;
      });
    });
  }

  function renderCatalogPage(q, category) {
    var resultsEl = document.querySelector("[data-catalog-results]");
    if (!resultsEl) return;
    var browseEl = document.querySelector("[data-catalog-browse]");
    var statusEl = document.querySelector(".search-status");
    var toolsEl = document.querySelector("[data-catalog-tools]");
    var hasQuery = !!(q && q.trim()) || (category && category !== "all");
    _catalogLastQuery = (q || "").trim();
    _catalogLastCategory = category || "all";

    if (!hasQuery) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      _catalogBaseMatches = [];
      _catalogMatches = [];
      _catalogShown = 0;
      if (_loadMoreBtn) _loadMoreBtn.hidden = true;
      if (browseEl) browseEl.hidden = false;
      if (statusEl) statusEl.hidden = true;
      if (toolsEl) toolsEl.hidden = true;
      return;
    }

    var loadMatches = _catalogLastQuery
      ? fetchCatalogSearchResults(_catalogLastQuery, category)
      : loadSearchIndex().then(function (products) {
          return filterCatalogFull(products, q, category);
        });

    loadMatches.then(function (matches) {
      if (!_catalogLastQuery && _searchIndexError && !matches.length) {
        if (browseEl) browseEl.hidden = true;
        if (toolsEl) toolsEl.hidden = true;
        if (_loadMoreBtn) _loadMoreBtn.hidden = true;
        resultsEl.hidden = false;
        resultsEl.innerHTML =
          '<div class="catalog-empty">' +
            '<p>Search is temporarily unavailable.</p>' +
            '<p class="catalog-empty-hint">Please check your connection and refresh the page.</p>' +
          '</div>';
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "Search is temporarily unavailable.";
        }
        return;
      }
      _catalogBaseMatches = matches;
      populateCatalogFilters(matches);
      applyCatalogFilterParams();
      if (browseEl) browseEl.hidden = true;
      if (toolsEl) toolsEl.hidden = false;
      renderCatalogFilteredResults();
    }).catch(function () {
      loadSearchIndex().then(function (products) {
        var matches = filterCatalogFull(products, q, category);
        _catalogBaseMatches = matches;
        populateCatalogFilters(matches);
        applyCatalogFilterParams();
        if (browseEl) browseEl.hidden = true;
        if (toolsEl) toolsEl.hidden = false;
        renderCatalogFilteredResults();
      });
    });
  }

  /* ── Navigation ── */
  function navigateTo(q, category) {
    pushRecent(q);
    if (isCatalogPage()) {
      /* Already on the results page: update fields, URL, and re-render in place. */
      var form = document.querySelector("[data-catalog-search]");
      if (form) {
        var qi = form.querySelector("input[name='q']");
        var cs = form.querySelector("select[name='category']");
        if (qi) qi.value = q;
        if (cs && category) cs.value = category;
      }
      updateCatalogUrl(q, category || "all");
      renderCatalogPage(q, category || "all");
      var anchor = document.getElementById("catalog");
      if (anchor) anchor.scrollIntoView({ behavior: "smooth" });
    } else {
      /* Everywhere else: go to the real catalog results page with the query. */
      var url = "/catalog?q=" + encodeURIComponent(q);
      if (category && category !== "all") {
        url += "&category=" + encodeURIComponent(category);
      }
      window.location.href = url;
    }
  }

  /* ── Initialize the catalog results page from the URL query string ── */
  function applyUrlParams() {
    if (!isCatalogPage()) {
      /* Category landing pages (protein, creatine, apparel, …) are generated
         with data-catalog-category on <main data-catalog-page>. Render the
         FULL search index for that category so shoppers see the whole
         assortment instead of the small baked-in preview shelf. The baked
         shelf stays visible until the index arrives (renderCatalogPage swaps
         it out once results are ready). */
      var catMain = document.querySelector(
        "main[data-catalog-page][data-catalog-category]"
      );
      var pageCategory = catMain
        ? catMain.getAttribute("data-catalog-category") || ""
        : "";
      if (pageCategory && document.querySelector("[data-catalog-results]")) {
        var pageParams = new URLSearchParams(window.location.search);
        renderCatalogPage(pageParams.get("q") || "", pageCategory);
      }
      return;
    }
    var params   = new URLSearchParams(window.location.search);
    var q        = params.get("q") || "";
    var category = params.get("category") || "all";
    var form = document.querySelector("[data-catalog-search]");
    if (form) {
      var qi = form.querySelector("input[name='q']");
      var cs = form.querySelector("select[name='category']");
      if (qi) qi.value = q;
      if (cs) cs.value = category;
    }
    renderCatalogPage(q, category);
  }

  /* ── Per-form initialization ── */
  function initForm(form) {
    var qInput    = form.querySelector("input[name='q']");
    if (!qInput) return;
    var catSelect = form.querySelector("select[name='category']");

    /* Wrap the form in a positioned container so the dropdown sits relative to it */
    var wrapper = document.createElement("div");
    wrapper.className = "search-wrapper";
    form.parentNode.insertBefore(wrapper, form);
    wrapper.appendChild(form);

    /* Dropdown shell */
    var dropdown = document.createElement("div");
    dropdown.className = "search-dropdown";
    dropdown.id = "search-suggestions-" + (++formCounter);
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Search suggestions");
    dropdown.hidden = true;
    wrapper.appendChild(dropdown);

    /* Accessibility: connect input → listbox */
    qInput.setAttribute("role", "combobox");
    qInput.setAttribute("aria-autocomplete", "list");
    qInput.setAttribute("aria-haspopup", "listbox");
    qInput.setAttribute("aria-controls", dropdown.id);
    qInput.setAttribute("aria-expanded", "false");
    qInput.setAttribute("autocomplete", "off");
    qInput.setAttribute("spellcheck", "false");

    var activeIdx  = -1;
    var debounceT  = null;

    function getCategory() { return catSelect ? catSelect.value : "all"; }
    function openDD() {
      dropdown.hidden = false;
      qInput.setAttribute("aria-expanded", "true");
    }
    function closeDD() {
      dropdown.hidden = true;
      qInput.setAttribute("aria-expanded", "false");
      qInput.removeAttribute("aria-activedescendant");
      activeIdx = -1;
    }
    function setActive(idx) {
      var items = dropdown.querySelectorAll("[role='option']");
      items.forEach(function (item, i) {
        if (!item.id) item.id = dropdown.id + "-option-" + i;
        item.classList.toggle("is-active", i === idx);
        item.setAttribute("aria-selected", String(i === idx));
      });
      activeIdx = idx;
      if (items[idx]) {
        qInput.setAttribute("aria-activedescendant", items[idx].id);
        items[idx].scrollIntoView({ block: "nearest" });
      } else {
        qInput.removeAttribute("aria-activedescendant");
      }
    }

    /* ── Render: empty / default state ── */
    function renderEmpty() {
      var recents = getRecents();
      var html = "";

      if (recents.length) {
        html += '<div class="sdd-section">';
        html += '<div class="sdd-label">Recent searches'
              + '<button type="button" class="sdd-clear-all">Clear all</button></div><ul>';
        recents.forEach(function (r) {
          html += '<li role="option" aria-selected="false" class="sdd-item sdd-item--recent" data-q="' + esc(r) + '">'
                + '<svg class="sdd-icon" viewBox="0 0 24 24" aria-hidden="true">'
                + '<polyline points="1 4 1 10 7 10"></polyline>'
                + '<path d="M3.51 15a9 9 0 1 0 .49-4.5"></path></svg>'
                + '<span class="sdd-item-text">' + esc(r) + '</span>'
                + '<button type="button" class="sdd-remove" data-remove="' + esc(r) + '" aria-label="Remove ' + esc(r) + ' from recent searches">&#x2715;</button>'
                + '</li>';
        });
        html += '</ul></div>';
      }

      html += '<div class="sdd-section"><div class="sdd-label">Trending on Athletonic</div><ul>';
      TRENDING.forEach(function (t) {
        html += '<li role="option" aria-selected="false" class="sdd-item sdd-item--trend"'
              + ' data-q="' + esc(t.q) + '" data-category="' + esc(t.category) + '">'
              + '<svg class="sdd-icon sdd-icon--trend" viewBox="0 0 24 24" aria-hidden="true">'
              + '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>'
              + '<polyline points="17 6 23 6 23 12"></polyline></svg>'
              + '<span class="sdd-item-text">' + esc(t.label) + '</span>'
              + '</li>';
      });
      html += '</ul></div>';

      dropdown.innerHTML = html;
      bindDropdownEvents();
      openDD();
    }

    /* ── Render: results ── */
    function renderResults(q, products) {
      var html = "";

      if (products.length) {
        html += '<ul class="sdd-results">';
        products.forEach(function (p) {
          var href = primaryProductHref(p);
          var brandLabel = displayBrand(p);
          html += '<li role="option" aria-selected="false" class="sdd-item sdd-item--product" data-href="' + esc(href) + '">'
                + '<img class="sdd-thumb" src="' + esc(p.image) + '" alt="" width="44" height="44" loading="lazy" decoding="async">'
                + '<div class="sdd-item-body">'
                + '<span class="sdd-brand">' + esc(brandLabel || p.brand) + '</span>'
                + '<span class="sdd-name">'  + highlight(p.name, q) + '</span>'
                + '</div>'
                + '<span class="sdd-price">' + fmtPrice(p.price_cents) + '</span>'
                + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<div class="sdd-empty">'
              + '<svg viewBox="0 0 24 24" aria-hidden="true">'
              + '<circle cx="11" cy="11" r="8"></circle>'
              + '<line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
              + (_searchIndexError
                ? '<p>Search is temporarily unavailable. Please check your connection and try again.</p>'
                : '<p>No results for <strong>&ldquo;' + esc(q) + '&rdquo;</strong></p>')
              + '</div>';
      }

      html += '<div class="sdd-footer">'
            + '<button type="button" class="sdd-see-all" data-q="' + esc(q) + '">'
            + 'See all results for &ldquo;<strong>' + esc(q) + '</strong>&rdquo;'
            + '</button></div>';

      dropdown.innerHTML = html;
      bindDropdownEvents();
      openDD();
    }

    /* ── Bind events on freshly-rendered dropdown content ── */
    function bindDropdownEvents() {
      /* Product items → navigate to PDP */
      dropdown.querySelectorAll(".sdd-item--product").forEach(function (item) {
        item.addEventListener("mousedown", function (e) {
          e.preventDefault();
          pushRecent(qInput.value.trim());
          window.location.href = item.dataset.href;
        });
      });

      /* Recent / trending items → fill + search */
      dropdown.querySelectorAll(".sdd-item--recent, .sdd-item--trend").forEach(function (item) {
        item.addEventListener("mousedown", function (e) {
          if (e.target.closest(".sdd-remove")) return;
          e.preventDefault();
          var q   = item.dataset.q        || "";
          var cat = item.dataset.category || "";
          qInput.value = q;
          if (catSelect && cat) catSelect.value = cat;
          navigateTo(q, cat || getCategory());
          closeDD();
        });
      });

      /* Remove-recent button */
      dropdown.querySelectorAll(".sdd-remove").forEach(function (btn) {
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
          e.stopPropagation();
          removeRecent(btn.dataset.remove);
          renderEmpty();
        });
      });

      /* Clear-all recents */
      var clearAll = dropdown.querySelector(".sdd-clear-all");
      if (clearAll) {
        clearAll.addEventListener("mousedown", function (e) {
          e.preventDefault();
          try { localStorage.removeItem(RECENT_KEY); } catch (ex) {}
          renderEmpty();
        });
      }

      /* "See all results" footer button */
      var seeAll = dropdown.querySelector(".sdd-see-all");
      if (seeAll) {
        seeAll.addEventListener("mousedown", function (e) {
          e.preventDefault();
          navigateTo(seeAll.dataset.q || qInput.value.trim(), getCategory());
          closeDD();
        });
      }
    }

    /* ── Run search query ── */
    /* The dropdown asks the server first (tiny per-query payloads instead of the
       multi-MB index download); if the API is unavailable (static dev server,
       offline) it permanently falls back to the local index for the session. */
    var _searchSeq = 0;
    function searchViaApi(q, category) {
      if (_searchApiBroken || typeof fetch !== "function") {
        return Promise.reject(new Error("search api unavailable"));
      }
      var url =
        (SCRIPT_ROOT || "/") +
        "api/catalog/search?q=" + encodeURIComponent(q) +
        "&category=" + encodeURIComponent(category || "all") +
        "&limit=" + DROPDOWN_MAX_RESULTS;
      return fetch(url).then(function (r) {
        if (!r.ok) {
          _searchApiBroken = true;
          throw new Error("search api http " + r.status);
        }
        return r.json();
      }).then(function (data) {
        if (!data || !Array.isArray(data.products)) {
          _searchApiBroken = true;
          throw new Error("search api bad payload");
        }
        return data.products;
      });
    }
    function runSearch(q) {
      var seq = ++_searchSeq;
      var category = getCategory();
      searchViaApi(q, category)
        .then(function (products) {
          if (seq !== _searchSeq) return;
          renderResults(q, products.slice(0, DROPDOWN_MAX_RESULTS));
        })
        .catch(function () {
          loadSearchIndex().then(function (products) {
            if (seq !== _searchSeq) return;
            renderResults(q, filterCatalogFull(products, q, category).slice(0, DROPDOWN_MAX_RESULTS));
          });
        });
    }

    /* ── Input change handler ── */
    function onInput() {
      var q = qInput.value.trim();
      activeIdx = -1;
      clearTimeout(debounceT);
      if (!q) {
        renderEmpty();
      } else {
        debounceT = setTimeout(function () { runSearch(q); }, DEBOUNCE_MS);
      }
    }

    /* ── Keyboard navigation ── */
    qInput.addEventListener("keydown", function (e) {
      /* Open dropdown if closed and arrow pressed */
      if (dropdown.hidden) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          onInput();
        }
        return;
      }

      var items = dropdown.querySelectorAll("[role='option']");
      var n = items.length;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActive(Math.min(activeIdx + 1, n - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          if (activeIdx <= 0) {
            activeIdx = -1;
            qInput.removeAttribute("aria-activedescendant");
            items.forEach(function (it) {
              it.classList.remove("is-active");
              it.setAttribute("aria-selected", "false");
            });
          } else {
            setActive(activeIdx - 1);
          }
          break;

        case "Enter":
          if (activeIdx >= 0 && items[activeIdx]) {
            e.preventDefault();
            items[activeIdx].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          } else {
            var q = qInput.value.trim();
            e.preventDefault();
            navigateTo(q, getCategory());
            closeDD();
          }
          break;

        case "Escape":
          e.preventDefault();
          closeDD();
          qInput.blur();
          break;

        case "Tab":
          closeDD();
          break;
      }
    });

    /* ── Focus opens dropdown ── */
    qInput.addEventListener("focus", function () {
      /* Warm the full index only where it is actually needed (catalog results
         page, or when the search API is unavailable); the dropdown itself is
         served by /api/catalog/search. */
      if (isCatalogPage() || _searchApiBroken) loadSearchIndex();
      if (qInput.value.trim()) {
        runSearch(qInput.value.trim());
      } else {
        renderEmpty();
      }
    });

    /* ── Input drives live preview ── */
    qInput.addEventListener("input", onInput);

    /* ── Category change re-filters preview ── */
    if (catSelect) {
      catSelect.addEventListener("change", function () {
        if (isCatalogPage()) {
          var q = qInput.value.trim();
          updateCatalogUrl(q, getCategory());
          renderCatalogPage(q, getCategory());
        } else if (!dropdown.hidden) {
          onInput();
        }
      });
    }

    /* ── Form submit ── */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = qInput.value.trim();
      var category = getCategory();
      pushRecent(q);
      closeDD();
      if (isCatalogPage()) {
        /* Own the catalog page: render from JSON in place, no reload. */
        updateCatalogUrl(q, category);
        renderCatalogPage(q, category);
        var statusEl = document.querySelector(".search-status");
        if (statusEl) statusEl.scrollIntoView({ block: "start", behavior: "smooth" });
      } else {
        navigateTo(q, category);
      }
    });

    /* ── Click outside closes dropdown ── */
    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) closeDD();
    });

    /* Preload silently so the first interaction feels instant: both the
       dropdown and the results page use the full search index (also warmed
       on input focus above). */
    loadCatalog();
    if (isCatalogPage()) loadSearchIndex();
  }

  /* ── Bootstrap ── */
  function initCatalogFilters() {
    if (!isCatalogPage()) return;
    document.querySelectorAll("[data-catalog-filter]").forEach(function (control) {
      control.addEventListener("change", function () {
        updateCatalogUrl(_catalogLastQuery, _catalogLastCategory);
        renderCatalogFilteredResults();
      });
      if (control.tagName === "INPUT") {
        control.addEventListener("input", function () {
          clearTimeout(control._catalogFilterTimer);
          control._catalogFilterTimer = setTimeout(function () {
            updateCatalogUrl(_catalogLastQuery, _catalogLastCategory);
            renderCatalogFilteredResults();
          }, 140);
        });
      }
    });
    var clearFilters = document.querySelector("[data-catalog-clear-filters]");
    if (clearFilters) {
      clearFilters.addEventListener("click", function () {
        document.querySelectorAll("[data-catalog-filter]").forEach(function (control) {
          control.value = control.getAttribute("data-catalog-filter") === "sort" ? "relevance" : "";
        });
        updateCatalogUrl(_catalogLastQuery, _catalogLastCategory);
        renderCatalogFilteredResults();
      });
    }
  }

  function init() {
    initCatalogFilters();
    document.querySelectorAll("[data-catalog-search]").forEach(initForm);
    applyUrlParams();
    /* Live-refresh helpers live in the cart module (first IIFE); reach them
       through its public API — referencing them directly here throws a
       ReferenceError that aborts the rest of this init. */
    var cartApi = window.AthletonicCart || {};
    if (typeof cartApi.refreshVisibleCatalogCards === "function") cartApi.refreshVisibleCatalogCards();
    if (typeof cartApi.initEmptyInlinePdpController === "function") cartApi.initEmptyInlinePdpController();
    normalizeVisibleBrandLabels(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* PDP size chips mirror the existing select and dispatch its normal change
   event. Variant availability and pricing remain owned by the cart module. */
(function () {
  "use strict";

  function enhanceSizeSelect(select) {
    if (!select || select.dataset.chipsReady === "true") return;
    var wrapper = select.closest(".pdp-variant");
    var variantName = String(select.dataset.variantName || (wrapper && wrapper.textContent) || "").toLowerCase();
    if (!wrapper || variantName.indexOf("size") === -1) return;

    var options = Array.from(select.options).filter(function (option) {
      return option.value && !option.hidden;
    });
    if (options.length < 2) return;

    var chips = document.createElement("div");
    chips.className = "pdp-option-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Choose size");
    options.forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pdp-option-chip";
      button.dataset.value = option.value;
      button.textContent = option.textContent.trim();
      button.disabled = option.disabled;
      button.addEventListener("click", function () {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
      });
      chips.appendChild(button);
    });

    function sync() {
      Array.from(chips.children).forEach(function (button) {
        var selected = button.dataset.value === select.value;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    select.dataset.chipsReady = "true";
    select.classList.add("pdp-variant-select-with-chips");
    select.insertAdjacentElement("afterend", chips);
    select.addEventListener("change", sync);
    sync();
  }

  function init() {
    document.querySelectorAll(".pdp-variant select[data-pdp-variant]").forEach(enhanceSizeSelect);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ============================================================
 *  i18n loader
 *  Loads the localization runtime (assets/i18n.js) on every page.
 *  cart.js is already present on all pages, so this guarantees the
 *  language switcher + translations run site-wide without editing
 *  each HTML file. The path prefix mirrors pagePathPrefix() above.
 * ============================================================ */
(function () {
  if (window.AthletonicI18n) return;
  /* Resolve i18n.js relative to THIS script's own location so it works
     at any directory depth (root, /pages/, /product/, and the localized
     /es/ tree) and under file:// previews. Falls back to the pathname
     heuristic if the script element can't be located. */
  var base = null;
  var self =
    document.currentScript ||
    document.querySelector('script[src*="assets/cart.js"]');
  if (self && self.src) base = self.src.replace(/assets\/cart\.js.*$/, "");
  if (base === null) {
    base = /\/(pages|product)\//.test(window.location.pathname) ? "../" : "./";
  }
  var s = document.createElement("script");
  s.src = base + "assets/i18n.js?v=20260730-controls-1";
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

/* ============================================================
 *  Currency loader
 *  Loads the FX display-conversion runtime (assets/currency.js)
 *  on every page, mirroring the i18n loader above.
 * ============================================================ */
(function () {
  if (window.AthletonicCurrency) return;
  var base = null;
  var self =
    document.currentScript ||
    document.querySelector('script[src*="assets/cart.js"]');
  if (self && self.src) base = self.src.replace(/assets\/cart\.js.*$/, "");
  if (base === null) {
    base = /\/(pages|product)\//.test(window.location.pathname) ? "../" : "./";
  }
  var s = document.createElement("script");
  s.src = base + "assets/currency.js?v=20260730-controls-1";
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

/* ── PDP variant image sync ────────────────────────────────────────────────
   Keep PDP imagery pinned to the exact variant image already selected by
   the page/controller. If a variant has no image_url, leave the current
   gallery state untouched instead of guessing across unrelated product
   images. This avoids flavor-change blinks and wrong-photo swaps. */
(function () {
  function initPdpImageFix() {
    var mainImg = document.getElementById("pdp-main-image");
    var selects = Array.prototype.slice.call(
      document.querySelectorAll("[data-pdp-variant]")
    );
    if (!mainImg || !selects.length) return;

    var thumbs = Array.prototype.slice.call(
      document.querySelectorAll("[data-pdp-thumb]")
    );
    var addBtn = document.querySelector("[data-pdp-add-button]");

    function apply() {
      var exactVariantSrc = addBtn && addBtn.dataset
        ? String(addBtn.dataset.cartImage || "").trim()
        : "";
      var src = exactVariantSrc;
      if (!src) return;
      if (mainImg.src !== src) mainImg.src = src;
      markActive(src);
      if (addBtn) addBtn.dataset.cartImage = src;
    }

    function markActive(src) {
      thumbs.forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-src") === src);
      });
    }

    window.AthletonicPdpImage = { pick: function () { return null; }, markActive: markActive };

    selects.forEach(function (s) {
      /* Registered after the inline PDP script's own listener, so this
         always runs last and wins. */
      s.addEventListener("change", apply);
    });
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdpImageFix);
  } else {
    initPdpImageFix();
  }
})();

/* ── Deal savings chips ────────────────────────────────────────────────────
   Computes "-N%" chips client-side from rendered prices (current + struck-
   through compare-at) so no page regeneration is needed. Applies to home
   hero deal cards and every .product-price-line; re-runs for catalog cards
   rendered later via a MutationObserver. Skips chips under 5% or over 90%. */
(function () {
  "use strict";
  if (document.body?.classList.contains("home-body")) return;

  function priceNum(text) {
    var digits = String(text || "").replace(/[^0-9.]/g, "");
    return digits ? parseFloat(digits) : NaN;
  }

  /* Prefer the true USD value stamped by assets/currency.js (data-usd)
     so chips stay correct when displayed prices are FX-converted. */
  function priceOf(el) {
    if (el && el.getAttribute) {
      var usd = parseFloat(el.getAttribute("data-usd"));
      if (isFinite(usd)) return usd;
    }
    return priceNum(el && el.textContent);
  }

  function addChip(container, current, original) {
    if (!container || container.querySelector(".deal-pct")) return;
    var pct = Math.round((1 - current / original) * 100);
    if (!isFinite(pct) || pct < 5 || pct > 90) return;
    var chip = document.createElement("span");
    chip.className = "deal-pct";
    chip.textContent = "-" + pct + "%";
    container.insertBefore(chip, container.firstChild);
  }

  function applyDealChips(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".product-price-line").forEach(function (line) {
      var current = line.querySelector("strong");
      var original = line.querySelector("span");
      if (!current || !original) return;
      addChip(line, priceOf(current), priceOf(original));
    });
    scope.querySelectorAll(".hero-deal").forEach(function (card) {
      var priceEl = card.querySelector("strong");
      var original = priceEl && priceEl.querySelector("span");
      if (!priceEl || !original) return;
      var current = priceEl.getAttribute("data-usd")
        ? parseFloat(priceEl.getAttribute("data-usd"))
        : priceNum(priceEl.childNodes[0] && priceEl.childNodes[0].textContent);
      addChip(priceEl, current, priceOf(original));
    });
  }

  var chipTimer = null;

  function queueDealChips() {
    clearTimeout(chipTimer);
    chipTimer = setTimeout(function () {
      applyDealChips(document);
    }, 120);
  }

  function init() {
    applyDealChips(document);
    /* Price lines are rewritten asynchronously (live catalog refresh, catalog
       search rendering) — watch for that and re-apply. addChip() is
       idempotent, so repeated passes are safe. */
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver(queueDealChips).observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
