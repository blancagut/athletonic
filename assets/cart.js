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

  function sectionHasVisibleProducts(section) {
    return $$(".product-card", section).some((card) => !card.hidden);
  }

  function applyCatalogSearch() {
    if (!searchForm) return;
    const formData = new FormData(searchForm);
    const query = String(formData.get("q") || "").trim().toLowerCase();
    const category = String(formData.get("category") || "all");
    let visibleCount = 0;

    for (const card of productCards) {
      const categoryMatches =
        category === "all" || card.dataset.category === category;
      const queryMatches =
        !query || (card.dataset.search || "").includes(query);
      const isVisible = categoryMatches && queryMatches;
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    }

    for (const section of $$(".market-section")) {
      if (section.id === "brands") continue;
      section.hidden = !sectionHasVisibleProducts(section);
    }

    if (searchStatus) {
      searchStatus.hidden = false;
      searchStatus.textContent =
        query || category !== "all"
          ? visibleCount + " products found"
          : "Showing all products";
    }
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

  if (searchForm && searchStatus && productCards.length) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      applyCatalogSearch();
      if (searchStatus) {
        searchStatus.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
    searchForm.addEventListener("input", applyCatalogSearch);
    searchForm.addEventListener("change", applyCatalogSearch);
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
