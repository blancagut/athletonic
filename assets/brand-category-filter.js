(function () {
  "use strict";

  var body = document.body;
  var grid = document.querySelector("[data-brand-grid]");
  var finder = document.querySelector(".listing-finder");
  var count = document.querySelector("[data-brand-count]");
  var input = document.querySelector("[data-brand-filter]");
  var clear = document.querySelector("[data-brand-clear]");
  var empty = document.querySelector("[data-brand-empty]");
  if (!grid || !finder || !body.dataset.brandSlug || !body.dataset.brandName) return;

  var brandSlug = body.dataset.brandSlug;
  var brandName = body.dataset.brandName;
  var products = [];
  var activeCategory = "all";
  var menu = document.createElement("nav");
  menu.className = "brand-category-filter";
  menu.setAttribute("data-brand-category-filter", "");
  menu.setAttribute("aria-label", "Filter products by type");
  finder.insertAdjacentElement("afterend", menu);

  var categories = [
    { id: "all", label: "All Products", test: function () { return true; } },
    { id: "boxing-gloves", label: "Boxing Gloves", test: function (value) { return /glove/.test(value) && !/bag glove|bag mitt|mma|deodorizer|bundle/.test(value); } },
    { id: "bag-gloves", label: "Bag Gloves", test: function (value) { return /bag glove|bag mitt/.test(value); } },
    { id: "mma-gloves", label: "MMA Gloves", test: function (value) { return /mma/.test(value) && /glove/.test(value); } },
    { id: "apparel", label: "Apparel", test: function (value) { return /apparel|trunks?|skirts?|t-?shirts?|\btees?\b|tanks?|robes?|caps?|hats?|boxing shoes|hoodies?|jackets?/.test(value); } },
    { id: "muay-thai-shorts", label: "Muay Thai Shorts", test: function (value) { return /short|trunk/.test(value) && !/mma/.test(value); } },
    { id: "mma-shorts", label: "MMA Shorts", test: function (value) { return /mma/.test(value) && /short|trunk/.test(value); } },
    { id: "tshirts", label: "T-Shirts & Tops", test: function (value) { return /shirt|t-shirt|tshirt|tank|hoodie|sweatshirt/.test(value); } },
    { id: "fight-apparel", label: "Fight Apparel", test: function (value) { return /jersey|sleeveless|sauna suit|track suit|track pant|hoodie|jacket/.test(value); } },
    { id: "gym-bags", label: "Gym Bags", test: function (value) { return /backpack|gym bag|clutch bag/.test(value); } },
    { id: "shin-guards", label: "Shin Guards", test: function (value) { return /shin guard|shin pad|shinpad/.test(value) && !/bundle/.test(value); } },
    { id: "pads-mitts", label: "Pads & Mitts", test: function (value) { return /focus mitt|thai pad|kick pad|kicking pad|belly pad|donut pad|thigh pad|boxing paddle|hybrid mitt/.test(value); } },
    { id: "bags", label: "Training Bags", test: function (value) { return /heavy bag|punching bag|banana bag|wall bag|sandbag/.test(value); } },
    { id: "head-guards", label: "Headgear", test: function (value) { return /head guard|headgear/.test(value); } },
    { id: "hand-wraps", label: "Hand Wraps", test: function (value) { return /hand ?wrap/.test(value); } },
    { id: "mouth-guards", label: "Mouth Guards", test: function (value) { return /mouth guard|mouthguard/.test(value); } },
    { id: "groin-guards", label: "Groin Guards", test: function (value) { return /groin|abdominal guard/.test(value); } },
    { id: "supports", label: "Supports", test: function (value) { return /ankle|elbow pad|knee pad|support/.test(value); } },
    { id: "robes", label: "Robes & Jackets", test: function (value) { return /robe|jacket/.test(value); } },
    { id: "accessories", label: "Accessories", test: function (value) { return /deodorizer|keychain|accessor/.test(value); } }
  ];

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function productText(product) {
    return [
      product.name,
      product.title,
      product.brand,
      product.category,
      product.category_name,
      product.section_title,
      product.id,
      product.slug
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function money(amount, isCents) {
    var value = Number(amount || 0);
    if (isCents) value /= 100;
    return "$" + value.toFixed(2);
  }

  function productImage(product) {
    var raw = product.image_url || product.image || "";
    if (!raw && Array.isArray(product.images) && product.images.length) raw = product.images[0].url || product.images[0];
    if (!raw && Array.isArray(product.gallery) && product.gallery.length) raw = product.gallery[0].url || product.gallery[0];
    return raw || "../assets/logo.png";
  }

  function productUrl(product) {
    var privateBrandCatalog = brandSlug === "hayabusa" || brandSlug === "everlast" || brandSlug === "cleto_reyes";
    if (privateBrandCatalog) {
      var productId = product.id || product.slug || product.product_id || "";
      var routeBrand = brandSlug === "cleto_reyes" ? "cleto-reyes" : brandSlug;
      return "/product/" + encodeURIComponent(routeBrand) + "/" + encodeURIComponent(productId);
    }
    if (product.url) {
      var sourceUrl = String(product.url);
      if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
      if (sourceUrl.charAt(0) === "/") return ".." + sourceUrl;
    }
    return "../product/" + encodeURIComponent(product.id || product.slug || product.product_id || "");
  }

  function collectionRank(product) {
    var value = productText(product);
    if (brandSlug === "boon") {
      if (/^mn\d+/i.test(product.name || "") && /short/i.test(product.name || "")) return 0;
      if (/^mt\d+/i.test(product.name || "") && /short/i.test(product.name || "")) return 1;
      if (/short/.test(value)) return 2;
      if (/glove/.test(value)) return 3;
      return 10;
    }
    if (brandSlug === "twins_special" || brandSlug === "fairtex") {
      if (/\bdeodorizer\b/.test(value)) return 999;
      if (/\bbgvl[ -]?3\b/.test(value) && !/\bfbgvl/.test(value)) return 0;
      if (/\b(lace[ -]?up|bgll1|bgll-1)\b/.test(value) && /\bgloves?\b/.test(value)) return 1;
      if (/\b(boxing|muay thai|fancy).*\bgloves?\b|\bgloves?.*\b(boxing|muay thai|fancy)\b/.test(value) && !/\b(bag|mma|deodorizer)\b/.test(value)) return 2;
      if (/\b(bag gloves?|bag mitts?|mma gloves?)\b/.test(value)) return 3;
    }
    return 10;
  }

  function compareProducts(a, b) {
    var rank = collectionRank(a) - collectionRank(b);
    if (rank) return rank;
    return String(a.name || a.title || "").localeCompare(String(b.name || b.title || ""));
  }

  function orderRelevantProducts(items) {
    var sourceOrder = new Map(items.map(function (product, index) {
      return [String(product.id || product.url || index), Number(product.source_order != null ? product.source_order : index)];
    }));
    return items.slice().sort(function (a, b) {
      var aRank = primoRelevance(a);
      var bRank = primoRelevance(b);
      if (aRank[0] !== bRank[0]) return aRank[0] - bRank[0];
      if (aRank[1] !== bRank[1]) return aRank[1] - bRank[1];
      var aMma = /\bmma\b/.test(productText(a)) ? 1 : 0;
      var bMma = /\bmma\b/.test(productText(b)) ? 1 : 0;
      if (aMma !== bMma) return aMma - bMma;
      return sourceOrder.get(String(a.id || a.url)) - sourceOrder.get(String(b.id || b.url));
    });
  }

  function primoCategory(product) {
    var value = [
      product.name,
      product.title,
      product.category,
      product.category_name,
      product.category_text,
      Array.isArray(product.tags) ? product.tags.join(" ") : "",
    ].filter(Boolean).join(" ").toLowerCase();
    if (/hand[\s-]*wrap/.test(value)) return "wrap";
    if (/shin[\s-]*guards?|shin[\s-]*pads?/.test(value)) return "shin";
    if (/\bshorts?\b|\btrunks?\b/.test(value)) return "shorts";
    if (/\bgloves?\b/.test(value)) return "glove";
    return "other";
  }

  function primoRelevance(product) {
    var tags = Array.isArray(product.tags) ? product.tags.join(" ") : "";
    var featured = /best[\s-]*seller|top[\s-]*seller|featured|popular/i.test(tags) ? 0 : 1;
    var unavailable = product.available === false || product.source_available === false ? 1 : 0;
    return [featured, unavailable];
  }

  function orderPrimoProducts(items) {
    var sourceOrder = new Map(items.map(function (product, index) {
      return [String(product.id || product.url || index), index];
    }));
    function relevanceCompare(a, b) {
      var aRank = primoRelevance(a);
      var bRank = primoRelevance(b);
      if (aRank[0] !== bRank[0]) return aRank[0] - bRank[0];
      if (aRank[1] !== bRank[1]) return aRank[1] - bRank[1];
      return sourceOrder.get(String(a.id || a.url)) - sourceOrder.get(String(b.id || b.url));
    }

    var groups = {
      glove: [],
      shorts: [],
      shin: [],
      other: [],
      wrap: [],
    };
    items.forEach(function (product) {
      groups[primoCategory(product)].push(product);
    });
    Object.keys(groups).forEach(function (key) { groups[key].sort(relevanceCompare); });

    // Mix the requested core categories across the first two desktop rows.
    var leadPattern = ["glove", "shorts", "shin", "glove", "shorts", "shin", "glove", "shorts"];
    var lead = [];
    leadPattern.forEach(function (category) {
      if (groups[category].length) lead.push(groups[category].shift());
    });
    var leadIds = new Set(lead.map(function (product) { return String(product.id || product.url); }));
    var remaining = items.filter(function (product) {
      return !leadIds.has(String(product.id || product.url));
    });
    var wraps = remaining.filter(function (product) { return primoCategory(product) === "wrap"; });
    var rest = remaining.filter(function (product) { return primoCategory(product) !== "wrap"; });
    rest.sort(relevanceCompare);
    wraps.sort(relevanceCompare);
    return lead.concat(rest, wraps);
  }

  function productCard(product) {
    var name = product.name || product.title || "Product";
    var variantRecords = Array.isArray(product.variants) ? product.variants : [];
    var variants = variantRecords.length;
    var defaultVariant = variantRecords[0] || null;
    var url = productUrl(product);
    var priceCents = product.price_cents != null
      ? Number(product.price_cents)
      : Math.round(Number(product.price || 0) * 100);
    var compareAtCents = product.compare_at_price_cents != null
      ? Number(product.compare_at_price_cents)
      : Math.round(Number(product.compare_at_price || 0) * 100);
    var price = money(priceCents, true);
    var compare = money(compareAtCents, true);
    var offer = compareAtCents > priceCents;
    var cartPriceCents = defaultVariant && defaultVariant.price_cents != null ? Number(defaultVariant.price_cents) : priceCents;
    var selectedOptions = defaultVariant && defaultVariant.selected_options ? defaultVariant.selected_options : {};
    var cartVariant = defaultVariant && defaultVariant.title || "";
    var requiresVariantChoice = variants > 1;
    var cartButton = '<button type="button" class="add-cart-button" ' + (requiresVariantChoice ? 'data-quick-add data-quick-add-product="' + escapeHtml(JSON.stringify(product)) + '" data-product-href="' + escapeHtml(url) + '"' : 'data-add-to-cart') +
      ' data-cart-id="' + escapeHtml(product.id || "") + '"' +
      ' data-cart-product-id="' + escapeHtml(product.id || "") + '"' +
      ' data-cart-variant-id="' + escapeHtml(defaultVariant ? (defaultVariant.variant_id || defaultVariant.id || "") : (product.default_variant_id || "")) + '"' +
      ' data-cart-brand="' + escapeHtml(product.brand || brandName) + '"' +
      ' data-cart-name="' + escapeHtml(name) + '"' +
      ' data-cart-price="' + escapeHtml((cartPriceCents / 100).toFixed(2)) + '"' +
      ' data-cart-price-cents="' + escapeHtml(cartPriceCents) + '"' +
      ' data-cart-currency="USD"' +
      ' data-cart-image="' + escapeHtml(productImage(product)) + '"' +
      ' data-cart-sku="' + escapeHtml((defaultVariant && defaultVariant.sku) || product.sku || "") + '"' +
      ' data-cart-selected-options="' + escapeHtml(JSON.stringify(selectedOptions)) + '"' +
      ' data-cart-variant="' + escapeHtml(cartVariant) + '"' +
      ' aria-label="' + (requiresVariantChoice ? 'Choose options for ' : 'Add ') + escapeHtml(name) + ' to cart">' + (requiresVariantChoice ? 'Choose options' : 'Add to cart') + '</button>';
    return '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '" data-search="' + escapeHtml(productText(product)) + '">' +
      '<a class="product-image" href="' + escapeHtml(url) + '"><img src="' + escapeHtml(productImage(product)) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async" /></a>' +
      '<div class="product-body"><span>' + escapeHtml(brandName) + '</span>' +
      '<h3><a class="product-card-link" href="' + escapeHtml(url) + '">' + escapeHtml(name) + '</a></h3>' +
      '<p>' + escapeHtml(product.category || product.category_name || product.section_title || "Training gear") + '</p>' +
      '<div class="product-price-line">' +
      (offer ? '<s class="product-compare-price">' + compare + '</s>' : "") +
      '<strong>' + price + '</strong>' +
      (offer ? '<span class="deal-pct">Offer</span>' : "") +
      '</div><div class="product-card-actions">' + cartButton +
      '<a class="add-cart-button product-options-button" href="' + escapeHtml(url) + '">' +
      (variants ? "View options" : "View product") +
      "</a></div></div></article>";
  }

  function availableCategories(visibleProducts) {
    return categories.filter(function (category) {
      return category.id === "all" || visibleProducts.some(function (product) {
        return category.test(productText(product));
      });
    });
  }

  function renderMenu(visibleProducts) {
    var available = availableCategories(visibleProducts);
    if (!available.some(function (category) { return category.id === activeCategory; })) activeCategory = "all";
    if (brandSlug === "cleto_reyes") {
      var prominentIds = ["all", "boxing-gloves", "mma-gloves", "apparel", "head-guards"];
      menu.innerHTML = '<nav class="cleto-category-shortcuts" aria-label="Cleto Reyes product categories">' +
        available.filter(function (category) { return prominentIds.indexOf(category.id) !== -1; }).map(function (category) {
          var selected = category.id === activeCategory;
          return '<a href="#' + category.id + '" data-brand-category="' + category.id + '"' +
            (selected ? ' class="is-active" aria-current="page"' : "") + ">" +
            escapeHtml(category.label) + "</a>";
        }).join("") +
        "</nav>";
      return;
    }
    menu.innerHTML = '<details class="brand-category-menu"><summary>Shop by category</summary><div class="brand-category-menu-panel">' +
      available.map(function (category) {
        var selected = category.id === activeCategory;
        return '<a href="#' + category.id + '" data-brand-category="' + category.id + '"' +
          (selected ? ' class="is-active" aria-current="page"' : "") + ">" +
          escapeHtml(category.label) + "</a>";
      }).join("") +
      "</div></details>";
  }

  function render() {
    var query = String(input && input.value || "").trim().toLowerCase();
    var searched = query
      ? products.filter(function (product) { return productText(product).indexOf(query) !== -1; })
      : products;
    renderMenu(searched);
    var category = categories.find(function (item) { return item.id === activeCategory; }) || categories[0];
    var visible = searched.filter(function (product) { return category.test(productText(product)); });

    grid.innerHTML = visible.map(productCard).join("");
    grid.setAttribute("aria-busy", "false");
    if (count) count.textContent = visible.length + " product" + (visible.length === 1 ? "" : "s") + (query ? " found" : " in this collection");
    if (empty) empty.hidden = visible.length !== 0;
    body.classList.remove("brand-catalog-loading");
    body.classList.add("brand-catalog-ready");
  }

  menu.addEventListener("click", function (event) {
    var link = event.target.closest("[data-brand-category]");
    if (!link) return;
    event.preventDefault();
    activeCategory = link.dataset.brandCategory || "all";
    render();
  });

  if (input) input.addEventListener("input", render);
  if (clear) {
    clear.addEventListener("click", function () {
      input.value = "";
      render();
      input.focus();
    });
  }

  var catalogUrl = {
    everlast: "../data/everlast-products.json",
    hayabusa: "../data/brand-page-catalog.json",
    cleto_reyes: "../data/cleto-reyes-products.json"
  }[brandSlug] || "../data/final/catalog.published.json";

  fetch(catalogUrl, { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Catalog HTTP " + response.status);
      return response.json();
    })
    .then(function (payload) {
      var all = Array.isArray(payload) ? payload : payload.products || [];
      products = all.filter(function (product) {
        return String(product.brand_slug || "").toLowerCase() === brandSlug || product.brand === brandName;
      });
      products = brandSlug === "primo" ? orderPrimoProducts(products) : brandSlug === "cleto_reyes" ? orderRelevantProducts(products) : products.sort(compareProducts);
      render();
    })
    .catch(function () {
      grid.innerHTML = "";
      grid.setAttribute("aria-busy", "false");
      if (count) count.textContent = "Could not load products.";
      body.classList.remove("brand-catalog-loading");
      body.classList.add("brand-catalog-ready");
    });
})();
