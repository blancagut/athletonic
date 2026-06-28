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

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector));

  function pagePathPrefix() {
    return /\/(pages|product)\//.test(window.location.pathname) ? "../" : "./";
  }

  function ensureMobileBottomNav() {
    if (document.querySelector(".mobile-bottom-nav")) return;
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
      '<a href="#department-nav" aria-label="Categories">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M4 6h16"></path>' +
          '<path d="M4 12h16"></path>' +
          '<path d="M4 18h16"></path>' +
        '</svg>' +
        '<span>Categories</span>' +
      '</a>' +
      '<a href="' + pathPrefix + 'pages/daily-deals.html" aria-label="Deals">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7"></path>' +
          '<path d="M2 7h20v5H2z"></path>' +
          '<path d="M12 7v13"></path>' +
          '<path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5c0 1.5 2 2.5 2 2.5z"></path>' +
          '<path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5c0 1.5-2 2.5-2 2.5z"></path>' +
        '</svg>' +
        '<span>Deals</span>' +
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

  function normalizeLegacyCatalogLinks() {
    const catalogHref = pagePathPrefix() + "pages/catalog.html";
    document.querySelectorAll('a[href="../#"], a[href="./#"]').forEach((link) => {
      if (link.textContent.trim().toLowerCase() === "athletonic catalog") {
        link.setAttribute("href", catalogHref);
      }
    });
  }

  ensureMobileBottomNav();
  normalizeLegacyCatalogLinks();

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
    return raw ? String(raw.split("::")[0] || "").trim() : "";
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
      selectedOptions,
      variant: selectedOptionsLabel(selectedOptions),
      image: variantImageUrl(variant),
      price: variantPriceValue(variant),
      compareAtPrice: variantCompareAtValue(variant, variantPriceValue(variant)),
      currency: String(variant.currency || product && product.currency || "").trim(),
    };
  }

  function normalizeCartItem(item) {
    if (!item || typeof item !== "object") return null;

    const rawId = String(item.id || item.productId || "").trim();
    const productId = normalizeProductId(item.productId || rawId);
    if (!productId) return null;

    const storedVariant =
      rawId.includes("::") && !item.variant
        ? rawId.slice(rawId.indexOf("::") + 2)
        : item.variant;
    const variantId = String(item.variantId || item.variant_id || "").trim();
    const selectedOptions = normalizeSelectedOptions(item.selectedOptions || item.selected_options);
    const variant = selectedOptionsLabel(selectedOptions) || String(storedVariant || "").trim();
    const quantity =
      item.quantity == null ? 1 : Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return null;

    const price = Number(item.price);
    const currency = String(item.currency || "USD").toUpperCase();
    const id = variantId
      ? productId + "::" + variantId
      : variant
        ? productId + "::" + variant
        : productId;
    return {
      id,
      productId,
      variantId,
      sku: String(item.sku || ""),
      brand: String(item.brand || ""),
      name: String(item.name || ""),
      price: Number.isFinite(price) && price > 0 ? price : 0,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      image: String(item.image || ""),
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
      return Array.isArray(parsed)
        ? parsed.map(normalizeCartItem).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    storageSet(CART_STORAGE_KEY, JSON.stringify(cart));
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

  function cartQuantity() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

    const prefix = pagePathPrefix();
    const title = accountPanel.querySelector("#account-title");
    const eyebrow = accountPanel.querySelector(".drawer-eyebrow");
    const session = getStoredAuthSession();
    const returnTo = encodeURIComponent(window.location.href);

    const quickLinks =
      '<div class="account-action-grid">' +
        '<a href="' + prefix + 'pages/orders.html">Your orders</a>' +
        '<a href="' + prefix + 'pages/order-tracking.html">Track a package</a>' +
        '<a href="' + prefix + 'pages/returns.html">Returns</a>' +
        '<a href="' + prefix + 'pages/daily-deals.html">Today\u2019s deals</a>' +
      '</div>';

    if (session && session.user) {
      const meta = session.user.user_metadata || {};
      const fullName = meta.full_name || meta.name || "";
      const firstName = fullName
        ? fullName.trim().split(" ")[0]
        : (session.user.email || "").split("@")[0];
      if (eyebrow) eyebrow.textContent = "Account";
      if (title) title.textContent = "Hello, " + (firstName || "athlete");
      actions.innerHTML =
        '<a class="account-action-primary" href="' + prefix + 'pages/account.html">Your account</a>' +
        quickLinks +
        '<button type="button" class="account-action-signout" data-account-signout>Sign out</button>';
    } else {
      if (eyebrow) eyebrow.textContent = "Account";
      if (title) title.textContent = "Hello, sign in";
      actions.innerHTML =
        '<a class="account-action-primary" href="' + prefix + 'pages/login.html?return_to=' + returnTo + '">Sign in</a>' +
        '<p class="account-action-note">New customer? <a href="' + prefix + 'pages/login.html?return_to=' + returnTo + '">Create your account</a>.</p>' +
        quickLinks;
    }
  }

  function signOutFromPanel() {
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

  function applyCheckoutLabels() {
    if (checkoutSubmit) checkoutSubmit.textContent = "Continue to secure payment";
    const note = checkoutForm ? $(".form-note", checkoutForm) : null;
    if (note) {
      note.textContent =
        "Payment is processed securely with Stripe. Athletonic creates your order after payment is confirmed.";
    }
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

  function renderCart() {
    const totalItems = cartQuantity();
    const total = cartTotal();
    for (const cartCount of cartCounts) {
      cartCount.textContent = String(totalItems);
      cartCount.hidden = totalItems === 0;
    }
    if (cartSubtotal) cartSubtotal.textContent = formatMoney(total, "USD");
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
      return;
    }

    if (checkoutForm) checkoutForm.hidden = false;
    if (checkoutSubmit) checkoutSubmit.disabled = false;

    for (const item of cart) {
      const article = document.createElement("article");
      article.className = "cart-item";

      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name;
      image.width = 78;
      image.height = 78;
      image.loading = "lazy";
      image.decoding = "async";

      const body = document.createElement("div");
      body.className = "cart-item-body";

      const brand = document.createElement("span");
      brand.textContent = item.brand;

      const itemTitle = item.variant
        ? item.name + " — " + item.variant
        : item.name;
      const title = document.createElement("h3");
      title.textContent = itemTitle;

      const price = document.createElement("strong");
      price.textContent = formatMoney(item.price * item.quantity, item.currency);

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
      body.append(brand, title, price, controls);
      article.append(image, body);
      cartItems.append(article);
    }
  }

  /**
   * Adds a product to the cart.
   * @param {object} payload - { id, brand, name, price, currency, image, variantId?, selectedOptions? }
   */
  function addItem(payload) {
    if (!payload || !payload.id) return;
    const productId = normalizeProductId(payload.productId || payload.id);
    if (!productId) return;
    const quantity = normalizeAddQuantity(payload.quantity);
    const selectedOptions = normalizeSelectedOptions(payload.selectedOptions);
    const variant = selectedOptionsLabel(selectedOptions) || String(payload.variant || "").trim();
    const variantId = String(payload.variantId || payload.variant_id || "").trim();
    const cartId = variantId
      ? productId + "::" + variantId
      : variant
        ? productId + "::" + variant
        : productId;
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
    saveCart();
    setFormStatus(checkoutStatus, "", "");
    renderCart();
    openCart();
  }

  function addToCartFromButton(button) {
    addItem({
      id: button.dataset.cartId,
      brand: button.dataset.cartBrand,
      name: button.dataset.cartName,
      price: Number(button.dataset.cartPrice || 0),
      currency: button.dataset.cartCurrency || "USD",
      image: button.dataset.cartImage,
      variantId: button.dataset.cartVariantId || "",
      sku: button.dataset.cartSku || "",
      selectedOptions: parseDatasetJson(button.dataset.cartSelectedOptions, {}),
      variant: button.dataset.cartVariant || "",
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
    renderCart();
  }

  function removeCartItem(id) {
    cart = cart.filter((cartItem) => cartItem.id !== id);
    saveCart();
    renderCart();
  }

  async function submitCheckout(email) {
    const session = getStoredAuthSession();
    const sessionEmail =
      session && session.user && session.user.email ? session.user.email : "";
    // When signed in, the server trusts the token identity over body.email,
    // so send the account email to keep the client display consistent.
    const effectiveEmail = sessionEmail || email;
    const payload = {
      email: effectiveEmail,
      cart: cart.map((item) => ({
        productId: item.productId || item.id,
        variant_id: item.variantId || "",
        variantId: item.variantId || "",
        sku: item.sku || "",
        selected_options: item.selectedOptions || {},
        variant: item.variant || "",
        quantity: item.quantity,
      })),
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

  // Search navigation: the submit handler attaches whenever the form exists.
  // On the catalog page the live-search module (below) owns submit and renders
  // results from data/athletonic-catalog.json. Everywhere else, submitting the
  // search navigates to the catalog page carrying the query string.
  const onCatalogResultsPage = /\/pages\/catalog\.html$/.test(
    window.location.pathname
  );

  function catalogResultsUrl(query, category) {
    const onSubPath = /\/(pages|product)\//.test(window.location.pathname);
    const base = (onSubPath ? "../" : "./") + "pages/catalog.html";
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category && category !== "all") params.set("category", category);
    const qs = params.toString();
    return qs ? base + "?" + qs : base;
  }

  if (searchForm && !onCatalogResultsPage) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(searchForm);
      const query = String(formData.get("q") || "").trim();
      const category = String(formData.get("category") || "all");
      window.location.href = catalogResultsUrl(query, category);
    });
  }

  document.addEventListener("click", (event) => {
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
      if (checkoutSubmit) checkoutSubmit.disabled = true;
      setFormStatus(checkoutStatus, "Creating secure checkout...", "pending");
      try {
        const checkout = await submitCheckout(email);
        storageSet(
          LAST_ORDER_REFERENCE_KEY,
          checkout.order_reference || ""
        );
        setFormStatus(
          checkoutStatus,
          "Redirecting to secure payment...",
          "success"
        );
        window.location.assign(checkout.url);
      } catch (error) {
        console.error(error);
        if (checkoutSubmit) checkoutSubmit.disabled = false;
        setFormStatus(
          checkoutStatus,
          error.message || "Could not start checkout. Your cart is still saved here.",
          "error"
        );
      }
    });
  }

  hydrateEmailFields();
  applyCheckoutLabels();
  renderCart();
  showCheckoutNoticeFromUrl();

  window.addEventListener("storage", (event) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      cart = loadCart();
      renderCart();
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
    openCart,
    clear() {
      cart = [];
      saveCart();
      renderCart();
    },
    formatMoney,
  };
})();

/* ============================================================
 *  Athletonic Live Search  —  self-contained module
 *  Appended to cart.js so it runs on every page automatically.
 * ============================================================ */
(function () {
  "use strict";

  var RECENT_KEY  = "ath-recent-searches-v1";
  var MAX_RESULTS = 7;
  var MAX_RECENT  = 5;
  var DEBOUNCE_MS = 80;
  var formCounter = 0;

  var TRENDING = [
    { label: "Whey protein",        q: "whey protein",   category: "protein"      },
    { label: "Creatine monohydrate",q: "creatine",       category: "creatine"     },
    { label: "Pre-workout",         q: "pre-workout",    category: "pre-workout"  },
    { label: "Electrolytes",        q: "electrolytes",   category: "hydration"    },
    { label: "Vitamins & minerals", q: "vitamins",       category: "vitamins"     },
    { label: "Greens powder",       q: "greens powder",  category: "greens"       },
    { label: "Protein bars",        q: "protein bars",   category: "bars-shakes"  },
    { label: "Recovery tools",      q: "recovery",       category: "recovery"     },
  ];

  /* ── Path helpers ── */
  function isProductOrPages() {
    return /\/(product|pages)\//.test(window.location.pathname);
  }
  function baseHref() {
    return isProductOrPages() ? "../" : "./";
  }
  function catalogUrl() {
    return baseHref() + "data/athletonic-catalog.json";
  }
  function isHome() {
    var p = window.location.pathname;
    return p === "/" || p === "" || p.endsWith("/index.html");
  }
  function isCatalogPage() {
    return /\/pages\/catalog\.html$/.test(window.location.pathname);
  }

  /* ── Catalog load (cached) ── */
  var _catalog = null;
  var _catalogReq = null;
  function loadCatalog() {
    if (_catalog) return Promise.resolve(_catalog);
    if (_catalogReq) return _catalogReq;
    _catalogReq = fetch(catalogUrl())
      .then(function (r) { return r.json(); })
      .then(function (d) { _catalog = d.products || []; return _catalog; })
      .catch(function () { _catalog = []; return _catalog; });
    return _catalogReq;
  }

  /* ── Full search index load (cached) ──
     The catalog RESULTS page searches this lightweight index of the broad
     active/US/official-source catalog. The dropdown still uses the curated
     athletonic-catalog.json preview set. */
  function searchIndexUrl() {
    return baseHref() + "data/search-index.json";
  }
  var _searchIndex = null;
  var _searchIndexReq = null;
  function loadSearchIndex() {
    if (_searchIndex) return Promise.resolve(_searchIndex);
    if (_searchIndexReq) return _searchIndexReq;
    _searchIndexReq = Promise.all([
      fetch(searchIndexUrl()).then(function (r) { return r.json(); }),
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
        _searchIndex = (indexData.products || []).map(function (product) {
          var richProduct = catalogById.get(normalizeCatalogProductId(product && product.id));
          return richProduct ? Object.assign({}, richProduct, product) : product;
        });
        return _searchIndex;
      })
      .catch(function () { _searchIndex = []; return _searchIndex; });
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
  function queryTokens(q) {
    var seen = {};
    return String(q || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(function (token) { return token && (token.length > 1 || /\d/.test(token)); })
      .filter(function (token) {
        if (seen[token]) return false;
        seen[token] = true;
        return true;
      });
  }
  function productSearchText(p) {
    return (p.search || [
      p.name,
      p.brand,
      p.section_title,
      sectionLabel(p),
      p.section_id,
    ].filter(Boolean).join(" ")).toLowerCase();
  }
  function matchesProductQuery(p, lq, tokens) {
    if (!lq) return true;
    var haystack = productSearchText(p);
    if (haystack.indexOf(lq) !== -1) return true;
    return tokens.length > 0 && tokens.every(function (token) {
      return haystack.indexOf(token) !== -1;
    });
  }
  function scoreCatalogProduct(p, lq, tokens) {
    var n = (p.name || "").toLowerCase();
    var b = (p.brand || "").toLowerCase();
    var label = (sectionLabel(p) || "").toLowerCase();
    var section = String(p.section_id || "").toLowerCase();
    var haystack = productSearchText(p);
    var score = scoreProduct(p, lq);

    if (!lq) return score;
    if (n === lq) score += 20;
    else if (n.startsWith(lq)) score += 12;
    if (b === lq) score += 10;
    if (label === lq || section === lq) score += 6;
    if (haystack.indexOf(lq) !== -1) score += 4;

    tokens.forEach(function (token) {
      if (n.indexOf(token) !== -1) score += 3;
      else if (b.indexOf(token) !== -1) score += 2;
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
    var lq = (q || "").trim().toLowerCase();
    var tokens = queryTokens(lq);
    var res = products.filter(function (p) {
      if (!productHasDisplayPrice(p)) return false;
      if (category && category !== "all" && p.section_id !== category) return false;
      return matchesProductQuery(p, lq, tokens);
    });
    if (lq) {
      res.sort(function (a, b) {
        return scoreCatalogProduct(b, lq, tokens) - scoreCatalogProduct(a, lq, tokens);
      });
    }
    return res;
  }

  /* Build a product card matching the generated markup so the delegated
     add-to-cart handler in the cart module works on these dynamic cards.
     Index records carry has_pdp + url so the link points at the generated PDP
     when one exists, otherwise the brand's official product page. */
  function catalogCardHtml(p) {
    var pdpHref = baseHref() + "product/" + encodeURIComponent(p.id) + ".html";
    var href = p.has_pdp ? pdpHref : (p.url || pdpHref);
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
    var purchasable = productHasDisplayPrice(p) && p.purchasable !== false && p.ready_for_sale !== false;
    var mustChooseOptions = Boolean(p.requires_variant_selection || variantOffer);
    var actionHtml = !purchasable
      ? '<button class="add-cart-button" type="button" disabled aria-disabled="true">Unavailable</button>'
      : mustChooseOptions
        ? '<a class="add-cart-button product-options-button" href="' + esc(href) +
            '" aria-label="View options for ' + esc(p.name || "product") +
        '">Choose options</a>'
        : '<button class="add-cart-button" type="button" data-add-to-cart' +
            ' data-cart-id="' + esc(p.id) + '"' +
            ' data-cart-product-id="' + esc(p.id) + '"' +
            ' data-cart-variant-id="' + esc(directVariantId) + '"' +
            ' data-cart-brand="' + esc(p.brand || "") + '"' +
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
          '<span>' + esc(p.brand || "") + '</span>' +
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
    var qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  /* Render the catalog results grid from the full search index, or restore the
     default browse view when there is no active query/category. Results are
     paginated (PAGE_SIZE per chunk) with a "Load more" button so a large match
     set never injects thousands of nodes at once. */
  var CATALOG_PAGE_SIZE = 60;
  var _catalogMatches = [];
  var _catalogShown = 0;
  var _loadMoreBtn = null;

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
    var btn = ensureLoadMoreButton(resultsEl);
    var remaining = _catalogMatches.length - _catalogShown;
    if (remaining > 0) {
      btn.hidden = false;
      btn.textContent = "Load more products";
    } else {
      btn.hidden = true;
    }
  }

  function renderCatalogPage(q, category) {
    var resultsEl = document.querySelector("[data-catalog-results]");
    if (!resultsEl) return;
    var browseEl = document.querySelector("[data-catalog-browse]");
    var statusEl = document.querySelector(".search-status");
    var hasQuery = !!(q && q.trim()) || (category && category !== "all");

    if (!hasQuery) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      _catalogMatches = [];
      _catalogShown = 0;
      if (_loadMoreBtn) _loadMoreBtn.hidden = true;
      if (browseEl) browseEl.hidden = false;
      if (statusEl) statusEl.hidden = true;
      return;
    }

    loadSearchIndex().then(function (products) {
      var activeCategoryLabel = categoryLabel(category);
      var matches = filterCatalogFull(products, q, category);
      _catalogMatches = matches;
      _catalogShown = 0;
      if (browseEl) browseEl.hidden = true;
      resultsEl.hidden = false;
      resultsEl.innerHTML = "";
      if (matches.length) {
        renderCatalogChunk(resultsEl);
      } else {
        if (_loadMoreBtn) _loadMoreBtn.hidden = true;
        resultsEl.innerHTML =
          '<div class="catalog-empty">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
              '<circle cx="11" cy="11" r="8"></circle>' +
              '<line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
            '<p>No results' + (q ? ' for <strong>&ldquo;' + esc(q) + '&rdquo;</strong>' : "") +
              (activeCategoryLabel ? " in " + esc(activeCategoryLabel) : "") + ".</p>" +
            '<p class="catalog-empty-hint">Try a broader term or browse a category above.</p>' +
          '</div>';
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          (matches.length ? "Showing matching products" : "No matching products") +
          (q ? ' for "' + q + '"' : "") +
          (activeCategoryLabel ? " in " + activeCategoryLabel : "");
      }
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
      var url = baseHref() + "pages/catalog.html?q=" + encodeURIComponent(q);
      if (category && category !== "all") {
        url += "&category=" + encodeURIComponent(category);
      }
      window.location.href = url;
    }
  }

  /* ── Initialize the catalog results page from the URL query string ── */
  function applyUrlParams() {
    if (!isCatalogPage()) return;
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
          var pdpHref = baseHref() + "product/" + encodeURIComponent(p.id) + ".html";
          var href = (p.has_pdp === false && p.url) ? p.url : pdpHref;
          html += '<li role="option" aria-selected="false" class="sdd-item sdd-item--product" data-href="' + esc(href) + '">'
                + '<img class="sdd-thumb" src="' + esc(p.image) + '" alt="" width="44" height="44" loading="lazy" decoding="async">'
                + '<div class="sdd-item-body">'
                + '<span class="sdd-brand">' + esc(p.brand) + '</span>'
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
              + '<p>No results for <strong>&ldquo;' + esc(q) + '&rdquo;</strong></p>'
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
    function runSearch(q) {
      loadSearchIndex().then(function (products) {
        renderResults(q, filterCatalogFull(products, q, getCategory()).slice(0, MAX_RESULTS));
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
          } else if (!isHome()) {
            var q = qInput.value.trim();
            if (q) {
              e.preventDefault();
              navigateTo(q, getCategory());
              closeDD();
            }
          }
          /* On home page with no selection: let form submit naturally (cart.js handles it) */
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
        if (!dropdown.hidden) onInput();
      });
    }

    /* ── Form submit ── */
    form.addEventListener("submit", function (e) {
      var q = qInput.value.trim();
      var category = getCategory();
      pushRecent(q);
      closeDD();
      if (isCatalogPage()) {
        /* Own the catalog page: render from JSON in place, no reload. */
        e.preventDefault();
        updateCatalogUrl(q, category);
        renderCatalogPage(q, category);
        var statusEl = document.querySelector(".search-status");
        if (statusEl) statusEl.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      /* Other pages: the cart module's submit handler navigates to the catalog
         page with the query string. */
    });

    /* ── Click outside closes dropdown ── */
    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) closeDD();
    });

    /* Preload silently so the first interaction feels instant: the dropdown
       uses the curated catalog; the results page uses the full search index. */
    loadCatalog();
    if (isCatalogPage()) loadSearchIndex();
  }

  /* ── Bootstrap ── */
  function init() {
    document.querySelectorAll("[data-catalog-search]").forEach(initForm);
    applyUrlParams();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
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
  s.src = base + "assets/i18n.js";
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();
