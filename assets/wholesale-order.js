(function () {
  const FIGHT_API_URL = "/api/wholesale/catalog";
  const BANK_API_URL = "/api/wholesale/quote-requests?bank_details=1";
  const ORDER_API_URL = "/api/wholesale/quote-requests?order=1";
  const CURRENCY_API_URL = "/api/currency/rates";
  const STORAGE_KEY = "athletonic-unit-order-v2";
  const LOCALE_STORAGE_KEY = "athletonic-unit-order-locale";
  const CURRENCY_STORAGE_KEY = "athletonic-unit-order-currency";
  const MAX_PROOF_BYTES = 3 * 1024 * 1024;
  const DEFAULT_QTY = 1;
  const QTY_PRESETS = [1, 2, 3, 6];
  const DEFAULT_LOCALE = "en";
  const CURRENCIES = [
    ["USD", "US Dollar", "en-US"],
    ["BRL", "Real brasileiro", "pt-BR"],
    ["MXN", "Peso mexicano", "es-MX"],
    ["ARS", "Peso argentino", "es-AR"],
    ["CLP", "Peso chileno", "es-CL"],
    ["COP", "Peso colombiano", "es-CO"],
    ["PEN", "Sol peruano", "es-PE"],
    ["UYU", "Peso uruguayo", "es-UY"],
    ["PYG", "Guaraní paraguayo", "es-PY"],
    ["BOB", "Boliviano", "es-BO"],
    ["CRC", "Colón costarricense", "es-CR"],
    ["DOP", "Peso dominicano", "es-DO"],
    ["GTQ", "Quetzal guatemalteco", "es-GT"],
    ["HNL", "Lempira hondureño", "es-HN"],
    ["NIO", "Córdoba nicaragüense", "es-NI"],
    ["VES", "Bolívar venezolano", "es-VE"],
    ["EUR", "Euro", "es-ES"],
    ["GBP", "British Pound", "en-GB"],
    ["CAD", "Canadian Dollar", "en-CA"],
  ];
  const CURRENCY_META = Object.fromEntries(
    CURRENCIES.map(([code, name, locale]) => [code, { name, locale }])
  );
  const REGION_CURRENCY = {
    BR: "BRL",
    MX: "MXN",
    AR: "ARS",
    CL: "CLP",
    CO: "COP",
    PE: "PEN",
    UY: "UYU",
    PY: "PYG",
    BO: "BOB",
    CR: "CRC",
    DO: "DOP",
    GT: "GTQ",
    HN: "HNL",
    NI: "NIO",
    VE: "VES",
    ES: "EUR",
    GB: "GBP",
    CA: "CAD",
  };
  const stepOrder = ["products", "details", "payment"];
  const sizeSuggestions = {
    "Training Gloves": ["6oz", "8oz", "10oz", "12oz", "14oz", "16oz"],
    "Bag Gloves": ["S", "M", "L", "XL"],
    Shorts: ["XS", "S", "M", "L", "XL", "XXL"],
    "Shin Guards": ["S", "M", "L", "XL"],
    Pads: ["Single", "Pair"],
    Accessories: ["One size"],
  };
  const dict = {
    en: {
      pageTitle: "Order | Athletonic",
      pageDescription:
        "Build your Athletonic unit order, choose product options, complete billing details, and upload payment proof.",
      "steps.products": "Products",
      "steps.details": "Billing",
      "steps.payment": "Payment",
      "hero.title": "Unit Order",
      "hero.copy":
        "Browse the full martial arts catalog, choose your size or color, and build the order line by line.",
      "summary.order": "Order",
      "summary.total": "Total",
      "summary.payment": "Payment",
      "summary.paymentValue": "Bank details at checkout",
      "products.kicker": "1. Products",
      "products.title": "Martial arts catalog",
      "products.clear": "Clear order",
      "products.searchLabel": "Search item",
      "products.searchPlaceholder": "Gloves, Fairtex, 12oz, red, shin guards...",
      "filters.gloves": "Gloves",
      "filters.bagGloves": "Bag gloves",
      "filters.shinGuards": "Shin guards",
      "filters.shorts": "Shorts",
      "filters.pads": "Pads",
      "filters.all": "All products",
      "manual.summary": "Add a manual line if the product is not listed",
      "manual.product": "Exact product",
      "manual.category": "Category",
      "manual.brand": "Brand",
      "manual.size": "Size / oz",
      "manual.color": "Color",
      "manual.quantity": "Quantity",
      "manual.notes": "Notes",
      "manual.add": "Add line",
      "details.kicker": "2. Billing",
      "details.title": "Customer, billing, and delivery details",
      "details.contact": "Contact",
      "details.name": "Name",
      "details.company": "Company",
      "details.email": "Invoice email",
      "details.whatsapp": "WhatsApp",
      "details.billing": "Billing",
      "details.legalName": "Legal name",
      "details.taxId": "Tax ID",
      "details.billingAddress": "Billing address",
      "details.city": "City",
      "details.region": "State / region",
      "details.country": "Country",
      "details.postalCode": "Postal code",
      "details.shipping": "Delivery",
      "details.shippingAddress": "Delivery address",
      "details.notes": "General notes",
      "details.notesPlaceholder": "Urgency, preferred substitutions, delivery instructions...",
      "payment.kicker": "3. Payment",
      "payment.title": "Bank transfer and payment proof",
      "payment.transfer": "Bank transfer",
      "payment.deposit": "Cash deposit",
      "payment.lockTitle": "Payment details are hidden",
      "payment.lockCopy": "Complete products and billing details to reveal the bank account.",
      "payment.showBank": "Show payment details",
      "payment.proof": "Payment proof",
      "payment.proofHint": "PNG, JPG, WEBP, or PDF.",
      "payment.submit": "Send order and invoice",
      "cart.kicker": "Order",
      "cart.title": "Summary",
      "cart.lines": "Lines",
      "cart.units": "Units",
      "cart.total": "Estimated total",
      "cart.currency": "Local currency",
      "cart.localEstimate": "Local estimate",
      "cart.localBase": "Invoice and payment are based on USD.",
      "cart.continue": "Continue",
      "common.pending": "Pending",
      "common.loadingCatalog": "Loading catalog...",
      "common.loadingPayment": "Loading payment details...",
      "common.loadingResults": "Refreshing catalog results...",
      "common.noResults":
        "No products matched that search. Try another term or add a manual line below.",
      "common.emptyOrder": "Your order is empty.",
      "common.noVariant": "No variant selected",
      "common.quoteOnly": "Price pending",
      "common.searchReady": "{count} products shown. Choose size, color, or ounces, then add a line.",
      "common.addAtLeastOne": "Add at least one line to the order.",
      "common.completeBilling": "Complete billing and delivery details.",
      "common.addBeforeBank": "Add products before viewing payment details.",
      "common.completeBeforeBank": "Complete billing details before viewing payment details.",
      "common.showBankFirst": "Open the payment details before sending the order.",
      "common.uploadProof": "Upload the payment proof.",
      "common.sending": "Sending order...",
      "common.sent": "Order {reference} sent. Your invoice PDF is on the way.",
      "common.sentFallback": "Order {reference} sent. Our sales team will confirm by email.",
      "common.lineAdded": "Line added to the order.",
      "common.manualAdded": "Manual line added.",
      "common.orderLine": "{count} lines",
      "common.perUnit": "/ unit",
      "common.localRate": "Estimate: 1 USD = {rate} {currency}.",
      "common.company": "Company",
      "common.receivingBank": "Receiving bank",
      "common.accountNumber": "Account number",
      "common.routing": "ACH / wire routing",
      "common.swift": "SWIFT / BIC",
      "common.bankAddress": "Bank address",
      "common.companyAddress": "Company address",
      "common.categoryFight": "Fight gear",
      "common.searchFallback": "Product, brand, category",
      "common.clearSuccess": "Order cleared.",
      "common.fileReady": "{name} ready.",
      "common.linesLabel": "{count} line|{count} lines",
    },
    es: {
      pageTitle: "Pedido | Athletonic",
      pageDescription:
        "Arma tu pedido unitario Athletonic, elige variantes, completa la factura y sube el comprobante de pago.",
      "steps.products": "Productos",
      "steps.details": "Factura",
      "steps.payment": "Pago",
      "hero.title": "Pedido Unitario",
      "hero.copy":
        "Explora todo el catálogo de artes marciales, elige talla, color u onzas y arma tu pedido línea por línea.",
      "summary.order": "Pedido",
      "summary.total": "Total",
      "summary.payment": "Pago",
      "summary.paymentValue": "Cuenta visible al final",
      "products.kicker": "1. Productos",
      "products.title": "Catálogo de artes marciales",
      "products.clear": "Limpiar pedido",
      "products.searchLabel": "Buscar producto",
      "products.searchPlaceholder": "Guantes, Fairtex, 12oz, rojo, espinilleras...",
      "filters.gloves": "Guantes",
      "filters.bagGloves": "Guantes de saco",
      "filters.shinGuards": "Espinilleras",
      "filters.shorts": "Shorts",
      "filters.pads": "Pads",
      "filters.all": "Todos los productos",
      "manual.summary": "Agregar línea manual si el producto no aparece",
      "manual.product": "Producto exacto",
      "manual.category": "Categoría",
      "manual.brand": "Marca",
      "manual.size": "Talla / oz",
      "manual.color": "Color",
      "manual.quantity": "Cantidad",
      "manual.notes": "Notas",
      "manual.add": "Agregar línea",
      "details.kicker": "2. Factura",
      "details.title": "Cliente, facturación y entrega",
      "details.contact": "Contacto",
      "details.name": "Nombre",
      "details.company": "Empresa",
      "details.email": "Email de factura",
      "details.whatsapp": "WhatsApp",
      "details.billing": "Facturación",
      "details.legalName": "Razón social",
      "details.taxId": "ID fiscal",
      "details.billingAddress": "Dirección fiscal",
      "details.city": "Ciudad",
      "details.region": "Estado / región",
      "details.country": "País",
      "details.postalCode": "Código postal",
      "details.shipping": "Entrega",
      "details.shippingAddress": "Dirección de entrega",
      "details.notes": "Notas generales",
      "details.notesPlaceholder": "Urgencia, sustituciones aceptadas, instrucciones de entrega...",
      "payment.kicker": "3. Pago",
      "payment.title": "Transferencia y comprobante",
      "payment.transfer": "Transferencia bancaria",
      "payment.deposit": "Depósito en efectivo",
      "payment.lockTitle": "Los datos de pago están ocultos",
      "payment.lockCopy": "Completa productos y facturación para revelar la cuenta bancaria.",
      "payment.showBank": "Mostrar datos de pago",
      "payment.proof": "Comprobante de pago",
      "payment.proofHint": "PNG, JPG, WEBP o PDF.",
      "payment.submit": "Enviar pedido y factura",
      "cart.kicker": "Pedido",
      "cart.title": "Resumen",
      "cart.lines": "Líneas",
      "cart.units": "Unidades",
      "cart.total": "Total estimado",
      "cart.currency": "Moneda local",
      "cart.localEstimate": "Estimado local",
      "cart.localBase": "La factura y el pago se basan en USD.",
      "cart.continue": "Continuar",
      "common.pending": "Por confirmar",
      "common.loadingCatalog": "Cargando catálogo...",
      "common.loadingPayment": "Cargando datos de pago...",
      "common.loadingResults": "Actualizando resultados...",
      "common.noResults":
        "No encontramos productos con esa búsqueda. Prueba otro término o agrega una línea manual abajo.",
      "common.emptyOrder": "Tu pedido está vacío.",
      "common.noVariant": "Sin variante seleccionada",
      "common.quoteOnly": "Precio por confirmar",
      "common.searchReady": "{count} productos mostrados. Elige talla, color u onzas y agrega una línea.",
      "common.addAtLeastOne": "Agrega al menos una línea al pedido.",
      "common.completeBilling": "Completa los datos de facturación y entrega.",
      "common.addBeforeBank": "Agrega productos antes de ver los datos de pago.",
      "common.completeBeforeBank": "Completa la facturación antes de ver los datos de pago.",
      "common.showBankFirst": "Abre los datos de pago antes de enviar el pedido.",
      "common.uploadProof": "Sube el comprobante de pago.",
      "common.sending": "Enviando pedido...",
      "common.sent": "Pedido {reference} enviado. La factura PDF va en camino.",
      "common.sentFallback": "Pedido {reference} enviado. El equipo comercial confirmará por email.",
      "common.lineAdded": "Línea agregada al pedido.",
      "common.manualAdded": "Línea manual agregada.",
      "common.orderLine": "{count} líneas",
      "common.perUnit": "/ unidad",
      "common.localRate": "Estimado: 1 USD = {rate} {currency}.",
      "common.company": "Empresa",
      "common.receivingBank": "Banco receptor",
      "common.accountNumber": "Número de cuenta",
      "common.routing": "Ruta ACH / wire",
      "common.swift": "SWIFT / BIC",
      "common.bankAddress": "Dirección del banco",
      "common.companyAddress": "Dirección de la empresa",
      "common.categoryFight": "Equipo de combate",
      "common.searchFallback": "Producto, marca, categoría",
      "common.clearSuccess": "Pedido limpiado.",
      "common.fileReady": "{name} listo.",
      "common.linesLabel": "{count} línea|{count} líneas",
    },
  };

  const els = {
    tabs: Array.from(document.querySelectorAll("[data-step-tab]")),
    panels: Array.from(document.querySelectorAll("[data-step-panel]")),
    localeSwitches: Array.from(document.querySelectorAll("[data-locale-switch]")),
    searchForm: document.querySelector("[data-search-form]"),
    search: document.querySelector("[data-product-search]"),
    searchStatus: document.querySelector("[data-search-status]"),
    results: document.querySelector("[data-product-results]"),
    stockPresets: Array.from(document.querySelectorAll("[data-stock-preset]")),
    productSuggestions: document.querySelector("[data-product-suggestions]"),
    manualForm: document.querySelector("[data-manual-form]"),
    manualCategory: document.querySelector("[data-manual-category]"),
    sizeSuggestions: document.querySelector("[data-size-suggestions]"),
    detailsForm: document.querySelector("[data-details-form]"),
    paymentMethods: Array.from(document.querySelectorAll("[data-payment-method]")),
    bankLock: document.querySelector("[data-bank-lock]"),
    revealBank: document.querySelector("[data-reveal-bank]"),
    bankDetails: document.querySelector("[data-bank-details]"),
    proofInput: document.querySelector("[data-proof-input]"),
    proofStatus: document.querySelector("[data-proof-status]"),
    orderStatus: document.querySelector("[data-order-status]"),
    submit: document.querySelector("[data-submit-order]"),
    cartItems: document.querySelector("[data-cart-items]"),
    cartCount: document.querySelector("[data-cart-count]"),
    totalLines: document.querySelector("[data-total-lines]"),
    totalUnits: document.querySelector("[data-total-units]"),
    totalEstimate: document.querySelector("[data-total-estimate]"),
    currencySelect: document.querySelector("[data-currency-select]"),
    localTotal: document.querySelector("[data-local-total]"),
    localRate: document.querySelector("[data-local-rate]"),
    summaryLines: document.querySelector("[data-summary-lines]"),
    summaryTotal: document.querySelector("[data-summary-total]"),
    nextStep: document.querySelector("[data-next-step]"),
    clearOrder: document.querySelector("[data-clear-order]"),
  };

  const state = {
    locale: loadLocale(),
    step: "products",
    catalogProducts: [],
    filteredProducts: [],
    activePreset: "",
    cart: loadCart(),
    currency: loadCurrency(),
    rates: { USD: 1 },
    ratesUpdated: null,
    bankLoaded: false,
    proof: null,
    busy: false,
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function storageGet(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Preference storage is optional.
    }
  }

  function loadLocale() {
    const saved = storageGet(LOCALE_STORAGE_KEY, "");
    if (saved === "en" || saved === "es") return saved;
    return DEFAULT_LOCALE;
  }

  function loadCart() {
    try {
      const parsed = JSON.parse(storageGet(STORAGE_KEY, "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
    } catch {
      // In-memory cart still works.
    }
  }

  function detectCurrency() {
    const saved = storageGet(CURRENCY_STORAGE_KEY, "");
    if (saved && CURRENCY_META[saved]) return saved;
    const locale = navigator.language || "";
    const region = String(locale.split("-")[1] || "").toUpperCase();
    return REGION_CURRENCY[region] || "USD";
  }

  function loadCurrency() {
    return detectCurrency();
  }

  function t(key, vars) {
    const localeTable = dict[state.locale] || dict.en;
    const raw = localeTable[key] || dict.en[key] || key;
    return Object.entries(vars || {}).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      raw
    );
  }

  function setLocale(locale) {
    state.locale = locale === "es" ? "es" : "en";
    storageSet(LOCALE_STORAGE_KEY, state.locale);
    document.documentElement.lang = state.locale;
    document.title = t("pageTitle");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", t("pageDescription"));
    els.localeSwitches.forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.localeSwitch === state.locale ? "true" : "false");
    });
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    if (els.search) els.search.placeholder = t("products.searchPlaceholder");
    if (els.proofStatus && !state.proof) els.proofStatus.textContent = t("payment.proofHint");
    const notes = els.detailsForm && els.detailsForm.querySelector('textarea[name="notes"]');
    if (notes) notes.placeholder = t("details.notesPlaceholder");
    applySummaryText();
    renderSizeSuggestions();
    renderProductSuggestions(state.catalogProducts);
    renderProducts(state.filteredProducts);
    renderCart();
    renderLocalTotal();
  }

  function formatUsd(cents) {
    const value = Number(cents);
    if (!Number.isFinite(value) || value <= 0) return "";
    return (value / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function formatCurrency(cents, code) {
    const value = Number(cents);
    const meta = CURRENCY_META[code] || CURRENCY_META.USD;
    if (!Number.isFinite(value) || value <= 0) return "";
    return (value / 100).toLocaleString(meta.locale, { style: "currency", currency: code });
  }

  function selectedOptionsKey(options) {
    return Object.keys(options || {})
      .sort()
      .map((key) => `${key}:${options[key]}`)
      .join("|");
  }

  function itemKey(item) {
    if (item.product_id) {
      return `${item.product_id}:${selectedOptionsKey(item.selected_options)}`;
    }
    return `manual:${item.name}:${item.brand || ""}:${selectedOptionsKey(item.selected_options)}:${item.notes || ""}`;
  }

  function unitPriceCents(item) {
    const unit = Number(item && (item.unit_price_cents || item.retail_price_cents));
    return Number.isInteger(unit) && unit > 0 ? unit : null;
  }

  function totalUnits() {
    return state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  function estimatedTotalCents() {
    return state.cart.reduce((sum, item) => {
      const unit = unitPriceCents(item);
      return unit ? sum + unit * Number(item.quantity || 0) : sum;
    }, 0);
  }

  function normalizeQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_QTY;
    return Math.min(parsed, 999);
  }

  function setStatus(message, isError) {
    if (!els.orderStatus) return;
    els.orderStatus.textContent = message || "";
    els.orderStatus.dataset.error = isError ? "true" : "false";
  }

  function setSearchStatus(message) {
    if (els.searchStatus) els.searchStatus.textContent = message || "";
  }

  function applySummaryText() {
    const lines = state.cart.length;
    if (els.summaryLines) els.summaryLines.textContent = t("common.orderLine", { count: lines });
    if (els.summaryTotal && !estimatedTotalCents()) els.summaryTotal.textContent = t("common.pending");
    if (els.nextStep) {
      els.nextStep.textContent = state.step === "payment" ? t("payment.submit") : t("cart.continue");
    }
  }

  function renderCurrencySelect() {
    if (!els.currencySelect) return;
    els.currencySelect.innerHTML = CURRENCIES.map(([code, name]) => {
      return `<option value="${escapeHtml(code)}">${escapeHtml(code)} - ${escapeHtml(name)}</option>`;
    }).join("");
    els.currencySelect.value = CURRENCY_META[state.currency] ? state.currency : "USD";
  }

  async function loadRates() {
    try {
      const response = await fetch(CURRENCY_API_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("rates unavailable");
      const payload = await response.json();
      state.rates = payload.rates || { USD: 1 };
      state.ratesUpdated = payload.updated || null;
      if (!state.rates[state.currency]) state.currency = "USD";
    } catch {
      state.rates = { USD: 1 };
      state.currency = "USD";
    }
    renderCurrencySelect();
    renderLocalTotal();
  }

  function renderLocalTotal() {
    if (!els.localTotal || !els.localRate) return;
    const total = estimatedTotalCents();
    const rate = Number(state.rates && state.rates[state.currency]);
    if (!total || !Number.isFinite(rate) || rate <= 0) {
      els.localTotal.textContent = t("common.pending");
      els.localRate.textContent = t("cart.localBase");
      return;
    }
    const localCents = Math.round(total * rate);
    const locale = (CURRENCY_META[state.currency] || CURRENCY_META.USD).locale;
    els.localTotal.textContent = formatCurrency(localCents, state.currency);
    els.localRate.textContent =
      state.currency === "USD"
        ? t("cart.localBase")
        : t("common.localRate", {
            rate: rate.toLocaleString(locale),
            currency: state.currency,
          });
  }

  function setStep(step) {
    state.step = stepOrder.includes(step) ? step : "products";
    els.panels.forEach((panel) => {
      panel.hidden = panel.dataset.stepPanel !== state.step;
    });
    els.tabs.forEach((tab) => {
      if (tab.dataset.stepTab === state.step) tab.setAttribute("aria-current", "step");
      else tab.removeAttribute("aria-current");
    });
    applySummaryText();
  }

  function nextStep() {
    if (state.step === "products") {
      if (!state.cart.length) {
        setSearchStatus(t("common.addAtLeastOne"));
        return;
      }
      setStep("details");
      return;
    }
    if (state.step === "details") {
      if (!detailsAreValid()) {
        setStatus(t("common.completeBilling"), true);
        els.detailsForm.reportValidity();
        return;
      }
      setStep("payment");
      return;
    }
    submitOrder();
  }

  function detailsAreValid() {
    return Boolean(els.detailsForm && els.detailsForm.checkValidity());
  }

  function renderSizeSuggestions() {
    if (!els.sizeSuggestions || !els.manualCategory) return;
    const values = sizeSuggestions[els.manualCategory.value] || ["S", "M", "L", "XL"];
    els.sizeSuggestions.innerHTML = values
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }

  function renderProductSuggestions(products) {
    if (!els.productSuggestions) return;
    const seen = new Set();
    const options = [];
    products.forEach((product) => {
      [product.name, product.brand, product.category_label].forEach((value) => {
        const cleanValue = clean(value);
        const key = cleanValue.toLowerCase();
        if (cleanValue && !seen.has(key)) {
          seen.add(key);
          options.push(`<option value="${escapeHtml(cleanValue)}"></option>`);
        }
      });
    });
    els.productSuggestions.innerHTML = options.slice(0, 120).join("");
  }

  function setActivePreset(button) {
    els.stockPresets.forEach((preset) => {
      preset.setAttribute("aria-pressed", preset === button ? "true" : "false");
    });
    state.activePreset = clean(button && button.dataset.stockPreset).toLowerCase();
  }

  function optionSelect(values, label, attr) {
    if (!Array.isArray(values) || !values.length) return "";
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <select ${attr}>
          ${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function productPrice(product) {
    const unit = formatUsd(product.retail_price_cents || product.unit_price_cents);
    return unit || t("common.quoteOnly");
  }

  function quantityPresetButtons() {
    return `
      <div class="wo-qty-tools" aria-label="Quick quantities">
        ${QTY_PRESETS.map((qty) => `<button type="button" data-qty-preset="${qty}">${qty}</button>`).join("")}
      </div>
    `;
  }

  function renderProducts(products) {
    if (!els.results) return;
    if (!products.length) {
      els.results.innerHTML = `<p class="wo-empty">${escapeHtml(t("common.noResults"))}</p>`;
      return;
    }

    els.results.innerHTML = products
      .map((product) => {
        const sizes = optionSelect(product.sizes, t("manual.size"), "data-product-size");
        const colors = optionSelect(product.colors, t("manual.color"), "data-product-color");
        const options = optionSelect(product.other_options, state.locale === "es" ? "Opción" : "Option", "data-product-option");
        return `
          <article class="wo-product" data-product-id="${escapeHtml(product.id)}">
            <img src="${escapeHtml(product.image_url || "../assets/logo.png")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
            <div class="wo-product-main">
              <span>${escapeHtml(product.brand)} · ${escapeHtml(product.category_label || t("common.categoryFight"))}</span>
              <strong>${escapeHtml(product.name)}</strong>
              <small>${escapeHtml(productPrice(product))}</small>
            </div>
            <div class="wo-product-controls">
              ${sizes}${colors}${options}
              <label>
                <span>${escapeHtml(t("manual.quantity"))}</span>
                <input type="number" min="1" max="999" step="1" value="${DEFAULT_QTY}" data-product-qty />
              </label>
              ${quantityPresetButtons()}
              <button type="button" data-add-product>+</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function productSearchText(product) {
    return [
      product.name,
      product.brand,
      product.category_label,
      product.product_type,
      ...(product.sizes || []),
      ...(product.colors || []),
      ...(product.other_options || []),
    ]
      .join(" ")
      .toLowerCase();
  }

  async function loadCatalog() {
    setSearchStatus(t("common.loadingCatalog"));
    try {
      const query = new URLSearchParams({ page_size: "3000" }).toString();
      const response = await fetch(`${FIGHT_API_URL}?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load catalog.");
      const payload = await response.json();
      state.catalogProducts = Array.isArray(payload.products) ? payload.products : [];
      renderProductSuggestions(state.catalogProducts);
      applyFilters();
    } catch (error) {
      state.catalogProducts = [];
      state.filteredProducts = [];
      renderProducts([]);
      setSearchStatus(error.message || "Could not load catalog.");
    }
  }

  function applyFilters() {
    const rawSearch = clean(els.search && els.search.value).toLowerCase();
    const preset = clean(state.activePreset).toLowerCase();
    const filtered = state.catalogProducts.filter((product) => {
      const haystack = productSearchText(product);
      if (preset && !haystack.includes(preset)) return false;
      if (!rawSearch) return true;
      return haystack.includes(rawSearch);
    });
    state.filteredProducts = filtered;
    renderProducts(filtered);
    setSearchStatus(
      filtered.length
        ? t("common.searchReady", { count: filtered.length })
        : t("common.noResults")
    );
  }

  function findProduct(card) {
    const id = card && card.dataset.productId;
    return state.catalogProducts.find((product) => String(product.id) === String(id)) || null;
  }

  function selectedOptionsForCard(card) {
    const options = {};
    const size = card.querySelector("[data-product-size]");
    const color = card.querySelector("[data-product-color]");
    const other = card.querySelector("[data-product-option]");
    if (size && size.value) options.Size = size.value;
    if (color && color.value) options.Color = color.value;
    if (other && other.value) options.Option = other.value;
    return options;
  }

  function addCartItem(item) {
    const key = itemKey(item);
    const existing = state.cart.find((entry) => itemKey(entry) === key);
    if (existing) {
      existing.quantity = Math.min(999, Number(existing.quantity || 1) + Number(item.quantity || 1));
    } else {
      state.cart.push(item);
    }
    saveCart();
    renderCart();
  }

  function handleProductClick(event) {
    const qtyPreset = event.target.closest("[data-qty-preset]");
    if (qtyPreset) {
      const card = event.target.closest("[data-product-id]");
      const qtyInput = card && card.querySelector("[data-product-qty]");
      if (qtyInput) qtyInput.value = qtyPreset.dataset.qtyPreset;
      return;
    }

    const add = event.target.closest("[data-add-product]");
    if (!add) return;
    const card = event.target.closest("[data-product-id]");
    const product = findProduct(card);
    if (!product) return;
    const qtyInput = card.querySelector("[data-product-qty]");
    const quantity = normalizeQuantity(qtyInput && qtyInput.value);
    addCartItem({
      product_id: product.id,
      brand: product.brand,
      name: product.name,
      category_label: product.category_label,
      product_type: product.product_type,
      image_url: product.image_url,
      url: product.url,
      selected_options: selectedOptionsForCard(card),
      quantity,
      unit_price_cents: product.retail_price_cents || null,
      retail_price_cents: product.retail_price_cents || null,
    });
    setSearchStatus(t("common.lineAdded"));
  }

  function handleManualSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const name = clean(fd.get("name"));
    if (!name) return;
    const selected = {};
    if (clean(fd.get("size"))) selected.Size = clean(fd.get("size"));
    if (clean(fd.get("color"))) selected.Color = clean(fd.get("color"));
    addCartItem({
      custom: true,
      brand: clean(fd.get("brand")) || "Athletonic",
      name,
      category_label: clean(fd.get("category")) || "Manual line",
      product_type: clean(fd.get("category")) || "Manual line",
      selected_options: selected,
      quantity: normalizeQuantity(fd.get("quantity")),
      notes: clean(fd.get("notes")),
      unit_price_cents: null,
      retail_price_cents: null,
    });
    form.reset();
    renderSizeSuggestions();
    setSearchStatus(t("common.manualAdded"));
  }

  function renderCart() {
    if (!els.cartItems) return;
    if (!state.cart.length) {
      els.cartItems.innerHTML = `<p class="wo-empty">${escapeHtml(t("common.emptyOrder"))}</p>`;
    } else {
      els.cartItems.innerHTML = state.cart
        .map((item) => {
          const options = Object.entries(item.selected_options || {})
            .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`)
            .join("");
          const unit = formatUsd(unitPriceCents(item));
          return `
            <article class="wo-cart-item" data-cart-key="${escapeHtml(itemKey(item))}">
              ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="" loading="lazy" />` : '<div class="wo-cart-fallback"></div>'}
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.brand)} · ${escapeHtml(item.category_label || "Order")}</span>
                <div class="wo-cart-options">${options || `<span>${escapeHtml(t("common.noVariant"))}</span>`}</div>
                ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}
                <div class="wo-cart-controls">
                  <label><span>${escapeHtml(t("manual.quantity"))}</span><input type="number" min="1" max="999" step="1" value="${escapeHtml(item.quantity)}" data-cart-qty /></label>
                  <b>${unit ? `${escapeHtml(unit)} ${escapeHtml(t("common.perUnit"))}` : escapeHtml(t("common.quoteOnly"))}</b>
                  <button type="button" data-remove-item>${escapeHtml(state.locale === "es" ? "Quitar" : "Remove")}</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    }

    const lines = state.cart.length;
    const units = totalUnits();
    const total = estimatedTotalCents();
    const totalText = total ? formatUsd(total) : t("common.pending");
    if (els.cartCount) els.cartCount.textContent = String(lines);
    if (els.totalLines) els.totalLines.textContent = String(lines);
    if (els.totalUnits) els.totalUnits.textContent = String(units);
    if (els.totalEstimate) els.totalEstimate.textContent = totalText;
    if (els.summaryLines) els.summaryLines.textContent = t("common.orderLine", { count: lines });
    if (els.summaryTotal) els.summaryTotal.textContent = totalText;
    applySummaryText();
    renderLocalTotal();
  }

  function handleCartInput(event) {
    const itemEl = event.target.closest("[data-cart-key]");
    if (!itemEl || !event.target.matches("[data-cart-qty]")) return;
    const item = state.cart.find((entry) => itemKey(entry) === itemEl.dataset.cartKey);
    if (!item) return;
    item.quantity = normalizeQuantity(event.target.value);
    event.target.value = String(item.quantity);
    saveCart();
    renderCart();
  }

  function handleCartClick(event) {
    const itemEl = event.target.closest("[data-cart-key]");
    if (!itemEl || !event.target.matches("[data-remove-item]")) return;
    state.cart = state.cart.filter((entry) => itemKey(entry) !== itemEl.dataset.cartKey);
    saveCart();
    renderCart();
  }

  function detailsPayload() {
    const fd = new FormData(els.detailsForm);
    return {
      name: clean(fd.get("name")),
      company_name: clean(fd.get("company_name")),
      email: clean(fd.get("email")),
      whatsapp: clean(fd.get("whatsapp")),
      country: clean(fd.get("country")),
      notes: clean(fd.get("notes")),
      billing: {
        legal_name: clean(fd.get("billing_legal_name")),
        tax_id: clean(fd.get("billing_tax_id")),
        address_line1: clean(fd.get("billing_address_line1")),
        city: clean(fd.get("billing_city")),
        region: clean(fd.get("billing_region")),
        country: clean(fd.get("billing_country")),
        postal_code: clean(fd.get("billing_postal_code")),
      },
      shipping: {
        address_line1: clean(fd.get("shipping_address_line1")),
        city: clean(fd.get("shipping_city")),
        region: clean(fd.get("shipping_region")),
        country: clean(fd.get("country")),
        postal_code: clean(fd.get("shipping_postal_code")),
      },
    };
  }

  function canRevealBank() {
    if (!state.cart.length) {
      setStatus(t("common.addBeforeBank"), true);
      setStep("products");
      return false;
    }
    if (!detailsAreValid()) {
      setStatus(t("common.completeBeforeBank"), true);
      setStep("details");
      els.detailsForm.reportValidity();
      return false;
    }
    return true;
  }

  function renderBankDetails(details) {
    if (!els.bankDetails) return;
    els.bankDetails.innerHTML = `
      <div class="wo-bank-card">
        <div><span>${escapeHtml(t("common.company"))}</span><strong>${escapeHtml(details.company_name)}</strong></div>
        <div><span>${escapeHtml(t("common.receivingBank"))}</span><strong>${escapeHtml(details.bank_name)}</strong></div>
        <div><span>${escapeHtml(t("common.accountNumber"))}</span><strong class="wo-account-number">${escapeHtml(details.account_number)}</strong></div>
        <div><span>${escapeHtml(t("common.routing"))}</span><strong>${escapeHtml(details.routing_number)}</strong></div>
        <div><span>${escapeHtml(t("common.swift"))}</span><strong>${escapeHtml(details.swift_bic)}</strong></div>
        <div><span>${escapeHtml(t("common.bankAddress"))}</span><strong>${escapeHtml(details.bank_address).replaceAll("\n", "<br />")}</strong></div>
        <div><span>${escapeHtml(t("common.companyAddress"))}</span><strong>${escapeHtml(details.company_address).replaceAll("\n", "<br />")}</strong></div>
      </div>
    `;
    els.bankDetails.hidden = false;
    if (els.bankLock) els.bankLock.hidden = true;
  }

  async function revealBankDetails() {
    if (!canRevealBank()) return;
    if (state.bankLoaded) {
      if (els.bankDetails) els.bankDetails.hidden = false;
      if (els.bankLock) els.bankLock.hidden = true;
      return;
    }
    setStatus(t("common.loadingPayment"));
    try {
      const response = await fetch(BANK_API_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load payment details.");
      const payload = await response.json();
      renderBankDetails(payload.bank_details || {});
      state.bankLoaded = true;
      setStatus("");
    } catch (error) {
      setStatus(error.message || "Could not load payment details.", true);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) reject(new Error("Could not prepare payment proof."));
            else resolve(blob);
          },
          file.type === "image/png" ? "image/png" : "image/jpeg",
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The selected file is not a valid image."));
      };
      img.src = url;
    });
  }

  async function handleProofChange() {
    const file = els.proofInput && els.proofInput.files && els.proofInput.files[0];
    state.proof = null;
    if (!file) {
      if (els.proofStatus) els.proofStatus.textContent = t("payment.proofHint");
      return;
    }

    try {
      let proofFile = file;
      if (file.type.startsWith("image/")) {
        const resized = await resizeImage(file);
        proofFile = new File([resized], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: resized.type || "image/jpeg",
        });
      }
      if (proofFile.size > MAX_PROOF_BYTES) {
        throw new Error(state.locale === "es" ? "El comprobante debe pesar menos de 3 MB." : "Payment proof must be smaller than 3 MB.");
      }
      const dataUrl = await readFileAsDataUrl(proofFile);
      const base64 = dataUrl.split(",")[1] || "";
      state.proof = {
        filename: proofFile.name,
        mime_type: proofFile.type || "application/octet-stream",
        size: proofFile.size,
        data_base64: base64,
      };
      if (els.proofStatus) els.proofStatus.textContent = t("common.fileReady", { name: proofFile.name });
    } catch (error) {
      if (els.proofInput) els.proofInput.value = "";
      if (els.proofStatus) els.proofStatus.textContent = error.message;
      state.proof = null;
    }
  }

  function selectedPaymentMethod() {
    const selected = els.paymentMethods.find((input) => input.checked);
    return selected ? selected.value : "bank_transfer";
  }

  async function submitOrder() {
    if (state.busy) return;
    if (!canRevealBank()) return;
    if (!state.bankLoaded) {
      setStatus(t("common.showBankFirst"), true);
      return;
    }
    if (!state.proof) {
      setStatus(t("common.uploadProof"), true);
      return;
    }

    state.busy = true;
    if (els.submit) els.submit.disabled = true;
    setStatus(t("common.sending"));
    try {
      const payload = {
        ...detailsPayload(),
        payment_method: selectedPaymentMethod(),
        payment_proof: state.proof,
        items: state.cart,
        source_page: window.location.pathname,
      };
      const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Athletonic-Order-Request": "1",
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Could not send order.");

      state.cart = [];
      state.proof = null;
      saveCart();
      renderCart();
      if (els.proofInput) els.proofInput.value = "";
      if (els.proofStatus) els.proofStatus.textContent = t("payment.proofHint");
      setStatus(
        body.buyer_email_sent
          ? t("common.sent", { reference: body.invoice_reference })
          : t("common.sentFallback", { reference: body.invoice_reference })
      );
    } catch (error) {
      setStatus(error.message || "Could not send order.", true);
    } finally {
      state.busy = false;
      if (els.submit) els.submit.disabled = false;
    }
  }

  function bindEvents() {
    let searchTimer = null;
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setStep(tab.dataset.stepTab));
    });
    els.localeSwitches.forEach((button) => {
      button.addEventListener("click", () => setLocale(button.dataset.localeSwitch));
    });
    if (els.nextStep) els.nextStep.addEventListener("click", nextStep);
    if (els.searchForm) {
      els.searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        applyFilters();
      });
    }
    if (els.search) {
      els.search.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(applyFilters, 120);
      });
    }
    els.stockPresets.forEach((button) => {
      button.addEventListener("click", () => {
        setActivePreset(button);
        applyFilters();
      });
    });
    if (els.results) els.results.addEventListener("click", handleProductClick);
    if (els.manualForm) els.manualForm.addEventListener("submit", handleManualSubmit);
    if (els.manualCategory) els.manualCategory.addEventListener("change", renderSizeSuggestions);
    if (els.cartItems) {
      els.cartItems.addEventListener("input", handleCartInput);
      els.cartItems.addEventListener("change", handleCartInput);
      els.cartItems.addEventListener("click", handleCartClick);
    }
    if (els.currencySelect) {
      els.currencySelect.addEventListener("change", () => {
        state.currency = els.currencySelect.value || "USD";
        storageSet(CURRENCY_STORAGE_KEY, state.currency);
        renderLocalTotal();
      });
    }
    if (els.revealBank) els.revealBank.addEventListener("click", revealBankDetails);
    if (els.proofInput) els.proofInput.addEventListener("change", handleProofChange);
    if (els.submit) els.submit.addEventListener("click", submitOrder);
    if (els.clearOrder) {
      els.clearOrder.addEventListener("click", () => {
        state.cart = [];
        saveCart();
        renderCart();
        setSearchStatus(t("common.clearSuccess"));
      });
    }
  }

  function boot() {
    bindEvents();
    renderCurrencySelect();
    renderSizeSuggestions();
    setLocale(state.locale);
    renderCart();
    setStep("products");
    loadCatalog();
    loadRates();
  }

  boot();
})();
