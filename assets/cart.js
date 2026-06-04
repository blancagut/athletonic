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

  const searchForm = $("[data-catalog-search]");
  const searchStatus = $(".search-status");
  const productCards = $$(".product-card");
  const drawerOverlay = $("[data-drawer-overlay]");
  const cartDrawer = $("[data-cart-drawer]");
  const accountPanel = $("[data-account-panel]");
  const cartItems = $("[data-cart-items]");
  const cartCount = $("[data-cart-count]");
  const cartSubtotal = $("[data-cart-subtotal]");
  const checkoutForm = $("[data-checkout-form]");
  const checkoutEmail = $("#checkout-email");
  const checkoutStatus = $("[data-checkout-status]");
  const checkoutSubmit = $("[data-checkout-submit]");
  const accountForm = $("[data-account-form]");
  const accountEmail = $("#guest-email");
  const accountStatus = $("[data-account-status]");
  const accountLabel = $("[data-account-label]");

  let cart = loadCart();

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function formatMoney(value, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(value || 0);
  }

  function cartQuantity() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function openPanel(panel) {
    if (!panel || !drawerOverlay) return;
    drawerOverlay.hidden = false;
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
  }

  function closePanels() {
    if (drawerOverlay) drawerOverlay.hidden = true;
    if (cartDrawer) {
      cartDrawer.hidden = true;
      cartDrawer.setAttribute("aria-hidden", "true");
    }
    if (accountPanel) {
      accountPanel.hidden = true;
      accountPanel.setAttribute("aria-hidden", "true");
    }
  }

  function openCart() {
    openPanel(cartDrawer);
  }

  function openAccount() {
    openPanel(accountPanel);
    if (accountEmail) accountEmail.focus();
  }

  function setFormStatus(element, message, state) {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state || "";
  }

  function hydrateEmailFields() {
    const email = localStorage.getItem(GUEST_EMAIL_KEY) || "";
    if (accountEmail) accountEmail.value = email;
    if (checkoutEmail) checkoutEmail.value = email;
    if (accountLabel) accountLabel.textContent = "Guest";
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
    if (cartCount) {
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
      image.loading = "lazy";

      const body = document.createElement("div");
      body.className = "cart-item-body";

      const brand = document.createElement("span");
      brand.textContent = item.brand;

      const title = document.createElement("h3");
      title.textContent = item.variant
        ? item.name + " — " + item.variant
        : item.name;

      const price = document.createElement("strong");
      price.textContent = formatMoney(item.price * item.quantity, item.currency);

      const controls = document.createElement("div");
      controls.className = "cart-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.cartDecrement = item.id;
      minus.setAttribute("aria-label", "Decrease quantity");
      minus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';

      const quantity = document.createElement("span");
      quantity.textContent = String(item.quantity);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.cartIncrement = item.id;
      plus.setAttribute("aria-label", "Increase quantity");
      plus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>';

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove-button";
      remove.dataset.cartRemove = item.id;
      remove.setAttribute("aria-label", "Remove item");
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';

      controls.append(minus, quantity, plus, remove);
      body.append(brand, title, price, controls);
      article.append(image, body);
      cartItems.append(article);
    }
  }

  /**
   * Adds a product to the cart.
   * @param {object} payload - { id, brand, name, price, currency, image, variant? }
   */
  function addItem(payload) {
    if (!payload || !payload.id) return;
    const cartId = payload.variant
      ? payload.id + "::" + payload.variant
      : String(payload.id);
    const existing = cart.find((cartItem) => cartItem.id === cartId);
    if (existing) {
      existing.quantity += payload.quantity || 1;
    } else {
      cart.push({
        id: cartId,
        productId: String(payload.id),
        brand: payload.brand || "",
        name: payload.name || "",
        price: Number(payload.price || 0),
        currency: payload.currency || "USD",
        image: payload.image || "",
        variant: payload.variant || "",
        quantity: payload.quantity || 1,
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
    const payload = {
      email,
      cart: cart.map((item) => ({
        productId: item.productId || item.id,
        variant: item.variant || "",
        quantity: item.quantity,
      })),
      attribution: captureAttribution(),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = "Could not start checkout.";
      try {
        const error = await response.json();
        message = error.message || message;
      } catch {
        message = await response.text();
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

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
      // PDP buttons render their own handler that calls window.AthletonicCart.addItem
      // and skip the data attributes path, so we only handle simple cards here.
      if (addButton.dataset.cartId) {
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

  const cartOpenButton = $("[data-cart-open]");
  if (cartOpenButton) cartOpenButton.addEventListener("click", openCart);

  const accountOpenButton = $("[data-account-open]");
  if (accountOpenButton)
    accountOpenButton.addEventListener("click", openAccount);

  // Responsive department menu: the hamburger toggles `.department-nav` on
  // narrow viewports. Accessible via keyboard and reflects state in aria-expanded.
  const navToggle = $("[data-nav-toggle]");
  const departmentNav = $("[data-department-nav]");
  if (navToggle && departmentNav) {
    const setNavOpen = (open) => {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
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

  if (drawerOverlay) drawerOverlay.addEventListener("click", closePanels);

  if (accountForm) {
    accountForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = String(new FormData(accountForm).get("email") || "").trim();
      localStorage.setItem(GUEST_EMAIL_KEY, email);
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
      localStorage.setItem(GUEST_EMAIL_KEY, email);
      hydrateEmailFields();
      if (checkoutSubmit) checkoutSubmit.disabled = true;
      setFormStatus(checkoutStatus, "Creating secure checkout...", "pending");
      try {
        const checkout = await submitCheckout(email);
        localStorage.setItem(
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

  // Footer: back-to-top
  const backToTopBtn = $("[data-back-to-top]");
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Footer: newsletter signup (stub)
  const newsletterForm = $("[data-footer-newsletter]");
  const newsletterStatus = $("[data-footer-newsletter-status]");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (event) => {
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
        newsletterStatus.textContent = "Thanks — you're on the list.";
        newsletterStatus.dataset.state = "success";
      }
      newsletterForm.reset();
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
     active/US/official-source catalog (thousands of products), not just the
     curated ~181 in athletonic-catalog.json (which still powers the dropdown). */
  function searchIndexUrl() {
    return baseHref() + "data/search-index.json";
  }
  var _searchIndex = null;
  var _searchIndexReq = null;
  function loadSearchIndex() {
    if (_searchIndex) return Promise.resolve(_searchIndex);
    if (_searchIndexReq) return _searchIndexReq;
    _searchIndexReq = fetch(searchIndexUrl())
      .then(function (r) { return r.json(); })
      .then(function (d) { _searchIndex = d.products || []; return _searchIndex; })
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
  function sectionLabel(p) {
    return p.section_title || SECTION_LABELS[p.section_id] || "";
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
  function searchProducts(products, q, category) {
    var lq = q.toLowerCase();
    var res = products.filter(function (p) {
      if (!p.available) return false;
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
    var res = products.filter(function (p) {
      if (p.available === false) return false;
      if (category && category !== "all" && p.section_id !== category) return false;
      if (!lq) return true;
      if (p.search) return p.search.indexOf(lq) !== -1;
      return (
        (p.name          || "").toLowerCase().includes(lq) ||
        (p.brand         || "").toLowerCase().includes(lq) ||
        (p.section_title || "").toLowerCase().includes(lq)
      );
    });
    if (lq) res.sort(function (a, b) { return scoreProduct(b, lq) - scoreProduct(a, lq); });
    return res;
  }

  /* Build a product card matching the generated markup so the delegated
     add-to-cart handler in the cart module works on these dynamic cards.
     Index records carry has_pdp + url so the link points at the generated PDP
     when one exists, otherwise the brand's official product page. */
  function catalogCardHtml(p) {
    var pdpHref = baseHref() + "product/" + encodeURIComponent(p.id) + ".html";
    var href = p.has_pdp ? pdpHref : (p.url || pdpHref);
    var price = (Number(p.price_cents) || 0) / 100;
    var priceStr = price.toFixed(2);
    var compare = p.compare_at_price_cents
      ? (Number(p.compare_at_price_cents) || 0) / 100
      : null;
    var currency = p.currency || "USD";
    var label = sectionLabel(p);
    var dealNote = "";
    if (p.deal && p.deal.discount_percent) {
      var ends = "";
      if (p.deal.expires_at) {
        var d = new Date(p.deal.expires_at);
        if (!isNaN(d)) {
          ends = " through " + d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        }
      }
      dealNote = '<p class="product-deal-note">' +
        esc(p.deal.discount_percent + "% off" + ends) + "</p>";
    }
    return (
      '<article class="product-card" data-product-id="' + esc(p.id) +
        '" data-category="' + esc(p.section_id || "") + '">' +
        '<a class="product-image" href="' + esc(href) + '">' +
          '<img src="' + esc(p.image || "") + '" alt="' + esc(p.name || "") +
            '" loading="lazy" />' +
        '</a>' +
        '<div class="product-body">' +
          '<span>' + esc(p.brand || "") + '</span>' +
          '<h3><a class="product-card-link" href="' + esc(href) + '">' +
            esc(p.name || "") + '</a></h3>' +
          '<p>' + esc(label) + '</p>' +
          '<div class="product-price-line">' +
            '<strong>' + fmtPrice(p.price_cents) + '</strong>' +
            (compare ? '<span>$' + compare.toFixed(2) + '</span>' : "") +
          '</div>' +
          dealNote +
          '<button class="add-cart-button" type="button" data-add-to-cart' +
            ' data-cart-id="' + esc(p.id) + '"' +
            ' data-cart-brand="' + esc(p.brand || "") + '"' +
            ' data-cart-name="' + esc(p.name || "") + '"' +
            ' data-cart-price="' + esc(priceStr) + '"' +
            ' data-cart-currency="' + esc(currency) + '"' +
            ' data-cart-image="' + esc(p.image || "") + '"' +
          '>Add to cart</button>' +
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
      btn.textContent =
        "Load more (" + remaining + " more)";
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
              (category && category !== "all" ? " in " + esc(category) : "") + ".</p>" +
            '<p class="catalog-empty-hint">Try a broader term or browse a category above.</p>' +
          '</div>';
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent =
          matches.length + " result" + (matches.length === 1 ? "" : "s") +
          (q ? ' for "' + q + '"' : "") +
          (category && category !== "all" ? " in " + category : "");
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
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Search suggestions");
    dropdown.hidden = true;
    wrapper.appendChild(dropdown);

    /* Accessibility: connect input → listbox */
    qInput.setAttribute("role", "combobox");
    qInput.setAttribute("aria-autocomplete", "list");
    qInput.setAttribute("aria-haspopup", "listbox");
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
      activeIdx = -1;
    }
    function setActive(idx) {
      var items = dropdown.querySelectorAll("[role='option']");
      items.forEach(function (item, i) {
        item.classList.toggle("is-active", i === idx);
        item.setAttribute("aria-selected", String(i === idx));
      });
      activeIdx = idx;
      if (items[idx]) items[idx].scrollIntoView({ block: "nearest" });
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
                + '<button type="button" class="sdd-remove" data-remove="' + esc(r) + '" aria-label="Remove">&#x2715;</button>'
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
          var href = baseHref() + "product/" + p.id + ".html";
          html += '<li role="option" aria-selected="false" class="sdd-item sdd-item--product" data-href="' + esc(href) + '">'
                + '<img class="sdd-thumb" src="' + esc(p.image) + '" alt="" loading="lazy">'
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
      loadCatalog().then(function (products) {
        renderResults(q, searchProducts(products, q, getCategory()));
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
