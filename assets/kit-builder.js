(function () {
  "use strict";

  const STORAGE_KEY = "athletonic-kit-builder-v1";
  const TEMPLATE_SLOTS = {
    "muay-thai": [
      { key: "gloves", role: "gloves", name: "Gloves", cue: "Start with your hands" },
      { key: "shinguards", role: "shinguards", name: "Shin guards", cue: "Protection for every round" },
      { key: "shorts", role: "shorts", name: "Fight shorts", cue: "Room to move" },
      { key: "headgear", role: "headgear", name: "Head guard", cue: "Train with confidence" },
      { key: "wraps", role: "wraps", name: "Hand wraps", cue: "Finish the details" },
      { key: "ankle", role: "ankle", name: "Ankle supports", cue: "Support every step" },
      { key: "bag", role: "bag", name: "Gym bag", cue: "Carry the whole kit" },
    ],
    boxing: [
      { key: "gloves", role: "gloves", name: "Boxing gloves", cue: "Find your weight" },
      { key: "headgear", role: "headgear", name: "Head guard", cue: "Protect the upper line" },
      { key: "shorts", role: "shorts", name: "Boxing shorts", cue: "Built for movement" },
      { key: "wraps", role: "wraps", name: "Hand wraps", cue: "Support every punch" },
      { key: "bag", role: "bag", name: "Gym bag", cue: "Carry the whole kit" },
    ],
    gym: [
      { key: "gloves", role: "gloves", name: "Gloves", cue: "Start with your hands" },
      { key: "headgear", role: "headgear", name: "Head guard", cue: "Train with confidence" },
      { key: "wraps", role: "wraps", name: "Hand wraps", cue: "Support every punch" },
      { key: "ankle", role: "ankle", name: "Ankle supports", cue: "Support every step" },
      { key: "bag", role: "bag", name: "Gym bag", cue: "Carry the whole kit" },
    ],
    free: [],
  };
  const FEATURED_BRANDS = ["Fairtex", "Twins Special", "Top King", "Cleto Reyes", "Boon", "Primo", "windy"];
  const COLOR_WORDS = ["black", "white", "red", "blue", "gold", "silver", "green", "pink", "purple", "orange", "yellow", "navy", "brown"];
  const PAGE_SIZE = 12;
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const nodes = {
    slots: $("[data-slot-list]"), progress: $("[data-slot-progress]"),
    canvas: $("[data-board-canvas]"), caption: $("[data-board-caption]"),
    search: $("[data-search]"), brandFilter: $("[data-brand-filter]"), saleOnly: $("[data-sale-only]"),
    activeFilter: $("[data-active-filter]"), showAll: $("[data-show-all]"),
    results: $("[data-results]"), resultCount: $("[data-result-count]"),
    loadMore: $("[data-load-more]"), kitCount: $("[data-kit-count]"),
    kitBrands: $("[data-kit-brands]"), kitTotal: $("[data-kit-total]"),
    kitDiscount: $("[data-kit-discount]"), kitDiscountAmount: $("[data-kit-discount-amount]"),
    kitOriginal: $("[data-kit-original]"), kitOffer: $("[data-kit-offer]"),
    kitOfferTitle: $("[data-kit-offer-title]"), kitOfferDetail: $("[data-kit-offer-detail]"),
    addKit: $("[data-add-kit]"), dialog: $("[data-variant-dialog]"),
    dialogImage: $("[data-dialog-image]"), dialogBrand: $("[data-dialog-brand]"),
    dialogTitle: $("[data-dialog-title]"), dialogPrice: $("[data-dialog-price]"),
    variantSelect: $("[data-variant-select]"), dialogAvailability: $("[data-dialog-availability]"),
    confirmAdd: $("[data-confirm-add]"),
  };

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
  })();
  const state = {
    template: TEMPLATE_SLOTS[saved?.template] ? saved.template : "muay-thai",
    items: Array.isArray(saved?.items) ? saved.items.filter((item) => item && item.productId && item.variantId).slice(0, 60) : [],
    activeSlot: null,
    browseAll: false,
    query: "",
    brand: "",
    saleOnly: false,
    visible: PAGE_SIZE,
    catalog: [],
    catalogById: new Map(),
    matches: [],
    pendingProduct: null,
    pendingSlot: null,
    pendingVariants: [],
  };
  state.activeSlot = firstEmptySlot();

  const toast = document.createElement("div");
  toast.className = "lab-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  document.body.appendChild(toast);
  let toastTimer;

  function notify(message, error) {
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(error));
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4400);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function normalized(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function slotsForCurrentTemplate() { return TEMPLATE_SLOTS[state.template] || []; }
  function firstEmptySlot() { return slotsForCurrentTemplate().find((slot) => !state.items.some((item) => item.slotKey === slot.key))?.key || null; }
  function slotForKey(key) { return slotsForCurrentTemplate().find((slot) => slot.key === key) || null; }
  function formatted(cents) { return money.format((Number(cents) || 0) / 100); }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ template: state.template, items: state.items })); } catch { /* Storage is optional. */ }
  }

  function imageOrInitial(image, brand) {
    return image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" />` : `<span aria-hidden="true">${escapeHtml((brand || "A").charAt(0))}</span>`;
  }

  function renderHeroImages() {
    const picks = {
      gloves: ["Twins Special", "Fairtex"],
      shinguards: ["Fairtex", "Top King"],
      shorts: ["Twins Special"],
    };
    for (const [role, brands] of Object.entries(picks)) {
      const target = document.querySelector(`[data-hero-image="${role}"]`);
      const product = state.catalog.find((entry) => entry.role === role && brands.includes(entry.brand) && entry.image && !/kids|junior|child/i.test(entry.name));
      if (target && product) target.src = product.image;
    }
  }

  function renderTemplates() {
    $$('[data-template]').forEach((button) => {
      const active = button.dataset.template === state.template;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderSlots() {
    const slots = slotsForCurrentTemplate();
    const filled = slots.filter((slot) => state.items.some((item) => item.slotKey === slot.key)).length;
    nodes.progress.textContent = state.template === "free" ? `${state.items.length} ADDED` : `${filled} / ${slots.length}`;
    const slotMarkup = slots.map((slot, index) => {
      const item = state.items.find((entry) => entry.slotKey === slot.key);
      const active = !state.browseAll && state.activeSlot === slot.key;
      return `<button type="button" class="lab-slot ${item ? "is-filled" : ""} ${active ? "is-active" : ""}" data-slot="${escapeHtml(slot.key)}" aria-pressed="${active}"><span class="lab-slot-num">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(slot.name)}</strong><small>${escapeHtml(item ? `${item.brand} · ${item.variantLabel}` : slot.cue)}</small></span><span class="lab-slot-action" aria-hidden="true">${item ? "↔" : "+"}</span></button>`;
    }).join("");
    const slotKeys = new Set(slots.map((slot) => slot.key));
    const extras = state.items.filter((item) => !slotKeys.has(item.slotKey));
    const extraMarkup = extras.length ? `<div class="lab-extras-label">MORE IN YOUR KIT</div>${extras.map((item) => `<div class="lab-extra"><span>${escapeHtml(item.name)}<small>${escapeHtml(item.brand)} · ${escapeHtml(item.variantLabel)}</small></span><button type="button" data-remove="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`).join("")}` : "";
    nodes.slots.innerHTML = slotMarkup + extraMarkup;
  }

  function renderBoard() {
    if (!state.items.length) {
      nodes.canvas.innerHTML = '<div class="lab-board-empty"><img class="lab-board-empty-icon" src="/assets/icon-512.png" alt="" /><strong>THE STAGE IS YOURS.</strong><p>Add your first piece and watch your kit take shape.</p><button type="button" data-empty-add>CHOOSE A PIECE <span aria-hidden="true">↗</span></button></div>';
      nodes.caption.textContent = "NO PIECES YET";
      return;
    }
    const tiers = [
      { key: "head", label: "HEAD", roles: ["headgear"] },
      { key: "upper", label: "HANDS & UPPER BODY", roles: ["gloves", "wraps", "apparel"] },
      { key: "waist", label: "WAIST", roles: ["shorts"] },
      { key: "lower", label: "LEGS & FOOTWORK", roles: ["shinguards", "ankle", "shoes"] },
      { key: "bag", label: "CARRY", roles: ["bag"] },
      { key: "extras", label: "EXTRAS", roles: ["apparel", "protection", "equipment"] },
    ];
    const roleOf = (item) => item.role || state.catalogById.get(item.productId)?.role || slotForKey(item.slotKey)?.role || "equipment";
    const arranged = tiers.map((tier) => ({
      ...tier,
      items: state.items.filter((item) => tier.roles.includes(roleOf(item))),
    })).filter((tier) => tier.items.length);
    let pieceNumber = 0;
    nodes.canvas.innerHTML = `<div class="lab-board-grid">${arranged.map((tier) => `<section class="lab-board-tier" aria-label="${tier.label}"><span class="lab-board-tier-label">${tier.label}</span><div class="lab-board-tier-items ${tier.items.length === 1 ? "is-single" : ""}">${tier.items.map((item) => `<article class="lab-board-tile" aria-label="${escapeHtml(item.name)} by ${escapeHtml(item.brand)}, ${escapeHtml(item.variantLabel)}">${imageOrInitial(item.image, item.brand)}<span class="lab-board-tile-index">${String(++pieceNumber).padStart(2, "0")}</span><button type="button" data-remove="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(item.name)}">×</button><div class="lab-board-tile-footer"><strong>${escapeHtml(item.brand)} / ${escapeHtml(item.name)}</strong><small>${escapeHtml(item.variantLabel)}</small></div></article>`).join("")}</div></section>`).join("")}</div>`;
    const uniqueBrands = new Set(state.items.map((item) => item.brand));
    nodes.caption.textContent = `${state.items.length} ${state.items.length === 1 ? "PIECE" : "PIECES"} / ${uniqueBrands.size} ${uniqueBrands.size === 1 ? "BRAND" : "BRANDS"}`;
  }

  function renderSummary() {
    const count = state.items.length;
    const uniqueCount = new Set(state.items.map((item) => item.productId)).size;
    const brands = [...new Set(state.items.map((item) => item.brand))];
    const preorder = state.items.filter((item) => item.preorder);
    const subtotalCents = state.items.reduce((sum, item) => sum + Number(item.price_cents || 0), 0);
    const discountCents = uniqueCount >= 3 ? Math.round(subtotalCents / 10) : 0;
    nodes.kitCount.textContent = `${count} ${count === 1 ? "PIECE" : "PIECES"}`;
    nodes.kitBrands.textContent = preorder.length
      ? `${brands.join(" × ")} · ${preorder.length} PRE-ORDER ${preorder.length === 1 ? "ITEM" : "ITEMS"}`
      : brands.length ? brands.join(" × ") : "YOUR MIX STARTS HERE";
    nodes.kitTotal.textContent = formatted(subtotalCents - discountCents);
    nodes.kitDiscount.hidden = discountCents === 0;
    nodes.kitDiscountAmount.textContent = `−${formatted(discountCents)}`;
    nodes.kitOriginal.hidden = discountCents === 0;
    nodes.kitOriginal.textContent = formatted(subtotalCents);
    nodes.kitOffer.classList.toggle("is-unlocked", discountCents > 0);
    nodes.kitOfferTitle.textContent = discountCents ? "10% KIT DISCOUNT APPLIED" : "10% OFF AT 3 PIECES";
    nodes.kitOfferDetail.textContent = discountCents
      ? `${formatted(discountCents)} saved on this kit.`
      : `${3 - uniqueCount} more different ${3 - uniqueCount === 1 ? "product" : "products"} to unlock it.`;
    nodes.addKit.disabled = count === 0;
  }

  function colorMatchScore(product) {
    if (!state.items.length) return 0;
    const colors = new Set(state.items.flatMap((item) => COLOR_WORDS.filter((color) => normalized(item.name).split(" ").includes(color))));
    const name = normalized(product.name).split(" ");
    return [...colors].some((color) => name.includes(color)) ? 5 : 0;
  }

  function diversified(products) {
    const buckets = new Map();
    for (const product of products) {
      if (!buckets.has(product.brand)) buckets.set(product.brand, []);
      buckets.get(product.brand).push(product);
    }
    const usedBrands = new Set(state.items.map((item) => item.brand));
    const order = [...buckets.keys()].sort((a, b) => {
      const score = (brand) => (usedBrands.has(brand) ? 1 : 0) + (FEATURED_BRANDS.includes(brand) ? 3 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    });
    for (const bucket of buckets.values()) bucket.sort((a, b) =>
      Number(/\b(kids?|junior|child(?:ren)?)\b/i.test(a.name)) - Number(/\b(kids?|junior|child(?:ren)?)\b/i.test(b.name)) ||
      colorMatchScore(b) - colorMatchScore(a) || a.name.localeCompare(b.name));
    const out = [];
    let remaining = products.length;
    while (remaining > 0) {
      for (const brand of order) {
        const item = buckets.get(brand).shift();
        if (item) { out.push(item); remaining -= 1; }
      }
    }
    return out;
  }

  function searchResults() {
    const role = state.browseAll ? null : slotForKey(state.activeSlot)?.role || null;
    const query = normalized(state.query);
    const terms = query.split(" ").filter(Boolean);
    const filtered = state.catalog.filter((product) => {
      if (role && product.role !== role) return false;
      if (state.brand && product.brand !== state.brand) return false;
      if (state.saleOnly && !(product.compare_at_price_cents > product.price_cents)) return false;
      if (!terms.length) return true;
      const haystack = product._search;
      return terms.every((term) => haystack.includes(term) || haystack.replace(/ /g, "").includes(term));
    });
    if (terms.length) {
      filtered.sort((a, b) => {
        const score = (product) => {
          const name = normalized(product.name);
          return (name.startsWith(query) ? 20 : 0) + (name.includes(query) ? 10 : 0) + (normalized(product.brand).includes(query) ? 5 : 0) + colorMatchScore(product);
        };
        return score(b) - score(a) || a.name.localeCompare(b.name);
      });
      return filtered;
    }
    return diversified(filtered);
  }

  function renderResults(reset) {
    if (reset) state.visible = PAGE_SIZE;
    state.matches = searchResults();
    const active = !state.browseAll && slotForKey(state.activeSlot);
    nodes.activeFilter.querySelector("span").textContent = active ? `PICKS FOR ${active.name.toUpperCase()}` : "FIGHT GEAR / EVERY FIGHT BRAND";
    nodes.showAll.hidden = !active;
    nodes.saleOnly.classList.toggle("is-active", state.saleOnly);
    nodes.saleOnly.setAttribute("aria-pressed", String(state.saleOnly));
    nodes.resultCount.textContent = `${state.matches.length.toLocaleString()} FOUND`;
    const page = state.matches.slice(0, state.visible);
    nodes.results.innerHTML = page.length ? page.map((product) => `<article class="lab-result"><div class="lab-result-image">${imageOrInitial(product.image, product.brand)}</div><div class="lab-result-info"><span class="lab-result-brand">${escapeHtml(product.brand)}</span><strong>${escapeHtml(product.name)}</strong><small>${product.compare_at_price_cents > product.price_cents ? `<em>SALE</em> ${formatted(product.price_cents)} <del>${formatted(product.compare_at_price_cents)}</del>` : `FROM ${formatted(product.price_cents)}`}</small></div><button type="button" class="lab-result-add" data-add-product="${escapeHtml(product.id)}" aria-label="Choose ${escapeHtml(product.name)}">+</button></article>`).join("") : `<div class="lab-no-results"><strong>NO MATCH YET.</strong>Try another name or explore the whole catalog.</div>`;
    nodes.loadMore.hidden = state.visible >= state.matches.length;
  }

  function renderAll() {
    renderTemplates();
    renderSlots();
    renderBoard();
    renderSummary();
    renderResults(true);
  }

  function selectedOptions(variant) {
    const raw = variant?.selected_options;
    if (raw && !Array.isArray(raw) && typeof raw === "object") return raw;
    const list = Array.isArray(variant?.option_values) ? variant.option_values : [];
    return Object.fromEntries(list.filter((entry) => entry?.name && entry?.value).map((entry) => [entry.name, entry.value]));
  }

  function variantLabel(variant) {
    const options = Object.values(selectedOptions(variant)).filter(Boolean);
    if (options.length) return options.join(" / ");
    const title = String(variant?.title || "").trim();
    return /^default(?: title)?$/i.test(title) || !title ? "Standard" : title;
  }

  function preorderInfo(variant) {
    const status = String(variant?.availability_status || "");
    return Boolean(variant?.preorder || /pre.?order/i.test(status));
  }

  function updateDialogVariant() {
    const variant = state.pendingVariants[Number(nodes.variantSelect.value)];
    if (!variant) { nodes.confirmAdd.disabled = true; return; }
    const available = variant.available !== false && Number(variant.price_cents || state.pendingProduct?.price_cents) > 0;
    const preorder = preorderInfo(variant);
    const note = String(variant.availability_note || "Delivery details at checkout");
    const priceCents = Number(variant.price_cents || state.pendingProduct?.price_cents || 0);
    const compareCents = Number(variant.compare_at_price_cents || state.pendingProduct?.compare_at_price_cents || 0);
    nodes.dialogPrice.innerHTML = compareCents > priceCents
      ? `<strong>${formatted(priceCents)}</strong> <del>${formatted(compareCents)}</del>`
      : formatted(priceCents);
    nodes.dialogAvailability.textContent = available ? (preorder ? `PRE-ORDER · ${note}` : "AVAILABLE · READY TO ADD") : "THIS VERSION IS UNAVAILABLE";
    nodes.dialogAvailability.classList.toggle("is-preorder", preorder);
    nodes.confirmAdd.disabled = !available;
    if (variant.image_url) nodes.dialogImage.src = variant.image_url;
  }

  async function fetchProducts(ids) {
    const response = await fetch(`/api/catalog/products?ids=${encodeURIComponent(ids.join(","))}`, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not load the current product options.");
    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  }

  async function openProduct(productId, slotKey, preferredVariantId) {
    const card = state.catalogById.get(productId);
    if (!card) { notify("This product is not available in the current catalog.", true); return; }
    state.pendingSlot = slotKey;
    state.pendingProduct = null;
    nodes.confirmAdd.disabled = true;
    nodes.dialogTitle.textContent = "LOADING OPTIONS...";
    nodes.dialogBrand.textContent = card.brand;
    nodes.dialogPrice.textContent = formatted(card.price_cents);
    nodes.dialogAvailability.textContent = "Loading sizes and colors...";
    nodes.dialogImage.src = card.image;
    nodes.dialogImage.alt = card.name;
    nodes.variantSelect.innerHTML = '<option value="">Loading...</option>';
    nodes.dialog.showModal();
    try {
      const products = await fetchProducts([productId]);
      const product = products.find((entry) => String(entry.id) === productId);
      if (!product) throw new Error("This product is no longer available.");
      state.pendingProduct = product;
      state.pendingVariants = Array.isArray(product.variants) && product.variants.length ? product.variants : [{
        variant_id: product.default_variant_id || `${product.id}::standard`,
        title: "Standard", selected_options: {}, price_cents: product.price_cents,
        currency: product.currency || "USD", available: product.available !== false,
        image_url: product.image,
      }];
      if (/^official-fairtex-fairtex-quick-handwraps-hw3-(?:black|white|pink|green)$/.test(String(product.id))) {
        const sized = state.pendingVariants.filter((variant) => /^(?:S\/M|L\/XL)$/i.test(String(variant.selected_options?.Size || variant.title || "")));
        if (sized.length) state.pendingVariants = sized;
      }
      nodes.dialogTitle.textContent = product.name || card.name;
      nodes.dialogBrand.textContent = product.brand || card.brand;
      nodes.dialogImage.src = product.image || card.image;
      nodes.variantSelect.innerHTML = state.pendingVariants.map((variant, index) => `<option value="${index}" ${variant.available === false ? "disabled" : ""}>${escapeHtml(variantLabel(variant))}${variant.available === false ? " · Unavailable" : ""} — ${formatted(variant.price_cents || product.price_cents)}</option>`).join("");
      let selectedIndex = state.pendingVariants.findIndex((variant) => String(variant.variant_id) === String(preferredVariantId || ""));
      if (selectedIndex < 0 || state.pendingVariants[selectedIndex].available === false) selectedIndex = state.pendingVariants.findIndex((variant) => variant.available !== false);
      nodes.variantSelect.value = String(Math.max(selectedIndex, 0));
      updateDialogVariant();
    } catch (error) {
      nodes.dialogTitle.textContent = "CAN'T LOAD THIS PIECE";
      nodes.dialogAvailability.textContent = error.message || "Please try again.";
      nodes.variantSelect.innerHTML = "";
      nodes.confirmAdd.disabled = true;
    }
  }

  function confirmProduct() {
    const product = state.pendingProduct;
    const variant = state.pendingVariants[Number(nodes.variantSelect.value)];
    if (!product || !variant || variant.available === false || !variant.variant_id) return;
    const slotKey = state.pendingSlot;
    const item = {
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      slotKey: slotKey || `extra-${Date.now()}`,
      role: state.catalogById.get(String(product.id))?.role || slotForKey(slotKey)?.role || "equipment",
      productId: String(product.id),
      variantId: String(variant.variant_id),
      name: String(product.name || "Product"),
      brand: String(product.brand || "Athletonic"),
      image: String(variant.image_url || product.image || ""),
      url: String(product.url || ""),
      sku: String(variant.sku || product.sku || ""),
      variantLabel: variantLabel(variant),
      selectedOptions: selectedOptions(variant),
      price_cents: Number(variant.price_cents || product.price_cents),
      currency: String(variant.currency || product.currency || "USD"),
      preorder: preorderInfo(variant),
      availabilityNote: String(variant.availability_note || ""),
    };
    if (slotKey) state.items = state.items.filter((entry) => entry.slotKey !== slotKey);
    state.items.push(item);
    state.activeSlot = firstEmptySlot();
    state.browseAll = state.template === "free" || !state.activeSlot;
    persist();
    nodes.dialog.close();
    renderAll();
    notify(`${item.name} added to your kit${item.preorder ? " · Pre-order" : ""}.`);
  }

  async function addKitToCart() {
    if (!state.items.length) return;
    nodes.addKit.disabled = true;
    nodes.addKit.firstChild.textContent = "CHECKING YOUR KIT ";
    try {
      const ids = [...new Set(state.items.map((item) => item.productId))];
      const products = [];
      for (let index = 0; index < ids.length; index += 50) products.push(...await fetchProducts(ids.slice(index, index + 50)));
      const byId = new Map(products.map((product) => [String(product.id), product]));
      const kitId = `kl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      const payloads = state.items.map((item) => {
        const product = byId.get(item.productId);
        const variant = product?.variants?.find((entry) => String(entry.variant_id) === item.variantId);
        if (!product || !variant || product.available === false || variant.available === false) throw new Error(`${item.name} is no longer available in the selected version. Choose another option.`);
        const cents = Number(variant.price_cents || product.price_cents);
        if (!(cents > 0)) throw new Error(`${item.name} has no current price. Choose another option.`);
        item.price_cents = cents;
        item.currency = String(variant.currency || product.currency || "USD");
        item.preorder = preorderInfo(variant);
        item.availabilityNote = String(variant.availability_note || "");
        return {
          id: item.productId, productId: item.productId, variantId: item.variantId,
          brand: product.brand || item.brand, name: product.name || item.name,
          price: cents / 100, currency: variant.currency || product.currency || "USD",
          image: variant.image_url || product.image || item.image,
          sku: variant.sku || product.sku || item.sku,
          selectedOptions: selectedOptions(variant), variant: variantLabel(variant), quantity: 1,
          kitId,
        };
      });
      if (!window.AthletonicCart?.addItems) throw new Error("The cart is still loading. Please try again.");
      persist();
      renderSummary();
      window.AthletonicCart.addItems(payloads);
      notify(`${payloads.length} ${payloads.length === 1 ? "piece" : "pieces"} added to your bag.`);
    } catch (error) {
      notify(error.message || "We couldn't add this kit right now.", true);
    } finally {
      nodes.addKit.firstChild.textContent = "ADD THE SET TO BAG ";
      nodes.addKit.disabled = state.items.length === 0;
    }
  }

  function setTemplate(template) {
    if (!TEMPLATE_SLOTS[template]) return;
    state.template = template;
    state.activeSlot = firstEmptySlot();
    state.browseAll = template === "free" || !state.activeSlot;
    persist();
    renderAll();
  }

  function selectSlot(slotKey) {
    state.activeSlot = slotKey;
    state.browseAll = false;
    renderSlots();
    renderResults(true);
    if (window.innerWidth < 650) document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function removeItem(uid) {
    state.items = state.items.filter((item) => item.uid !== uid);
    if (!state.activeSlot && state.template !== "free") state.activeSlot = firstEmptySlot();
    persist();
    renderAll();
  }

  function bindEvents() {
    $$('[data-template]').forEach((button) => button.addEventListener("click", () => setTemplate(button.dataset.template)));
    nodes.slots.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove]");
      if (remove) { removeItem(remove.dataset.remove); return; }
      const slot = event.target.closest("[data-slot]");
      if (slot) selectSlot(slot.dataset.slot);
    });
    nodes.canvas.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove]");
      if (remove) removeItem(remove.dataset.remove);
      if (event.target.closest("[data-empty-add]")) document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("[data-add-anything]").addEventListener("click", () => {
      state.activeSlot = null;
      state.browseAll = true;
      renderSlots(); renderResults(true);
      document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
      nodes.search.focus({ preventScroll: true });
    });
    let searchTimer;
    nodes.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.query = nodes.search.value; renderResults(true); }, 90);
    });
    nodes.brandFilter.addEventListener("change", () => { state.brand = nodes.brandFilter.value; renderResults(true); });
    nodes.saleOnly.addEventListener("click", () => { state.saleOnly = !state.saleOnly; renderResults(true); });
    $("[data-clear-filters]").addEventListener("click", () => {
      state.query = ""; state.brand = ""; state.saleOnly = false; nodes.search.value = ""; nodes.brandFilter.value = ""; renderResults(true);
    });
    nodes.showAll.addEventListener("click", () => { state.browseAll = true; state.activeSlot = null; renderSlots(); renderResults(true); });
    nodes.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderResults(false); });
    nodes.results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-product]");
      if (button) openProduct(button.dataset.addProduct, state.browseAll ? null : state.activeSlot);
    });
    nodes.variantSelect.addEventListener("change", updateDialogVariant);
    nodes.confirmAdd.addEventListener("click", confirmProduct);
    $("[data-close-dialog]").addEventListener("click", () => nodes.dialog.close());
    nodes.dialog.addEventListener("click", (event) => { if (event.target === nodes.dialog) nodes.dialog.close(); });
    nodes.addKit.addEventListener("click", addKitToCart);
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); nodes.search.focus(); document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
  }

  async function init() {
    bindEvents();
    try {
      const response = await fetch("/assets/kit-builder-index.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Could not open the catalog.");
      const index = await response.json();
      state.catalog = (index.products || []).map((product) => ({ ...product, _search: normalized(`${product.name} ${product.brand} ${product.section} ${product.id}`) }));
      state.catalogById = new Map(state.catalog.map((product) => [product.id, product]));
      nodes.brandFilter.innerHTML = '<option value="">All fight brands</option>' + (index.brands || []).map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("");
      const kitItems = state.items.filter((item) => state.catalogById.has(item.productId));
      if (kitItems.length !== state.items.length) {
        state.items = kitItems;
        state.activeSlot = firstEmptySlot();
        state.browseAll = state.template === "free" || !state.activeSlot;
        persist();
      }
      renderHeroImages();
      renderAll();
      const params = new URLSearchParams(location.search);
      const productId = params.get("product");
      if (productId && state.catalogById.has(productId)) {
        const card = state.catalogById.get(productId);
        const slot = slotsForCurrentTemplate().find((entry) => entry.role === card.role && !state.items.some((item) => item.slotKey === entry.key));
        openProduct(productId, slot?.key || null, params.get("variant"));
      }
    } catch (error) {
      nodes.results.innerHTML = '<div class="lab-no-results"><strong>CATALOG UNAVAILABLE.</strong>Refresh this page to try again.</div>';
      nodes.resultCount.textContent = "OFFLINE";
      notify(error.message || "Could not open the catalog.", true);
    }
  }

  init();
})();
