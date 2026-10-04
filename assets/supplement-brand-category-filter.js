(function () {
  "use strict";

  var body = document.body;
  var grid = document.querySelector("[data-brand-grid]");
  var finder = document.querySelector(".listing-finder");
  var count = document.querySelector("[data-brand-count]");
  var input = document.querySelector("[data-brand-filter]");
  var clear = document.querySelector("[data-brand-clear]");
  var empty = document.querySelector("[data-brand-empty]");
  if (!grid || !finder || body.dataset.brandCatalog !== "supplements" || !body.dataset.brandSlug || !body.dataset.brandName) return;

  var brandSlug = body.dataset.brandSlug;
  var brandName = body.dataset.brandName;
  var products = [];
  var activeCategory = "all";
  var menu = document.createElement("nav");
  menu.className = "brand-category-filter";
  menu.setAttribute("data-brand-category-filter", "");
  menu.setAttribute("aria-label", "Filter supplements by category");
  finder.insertAdjacentElement("afterend", menu);

  var categories = [
    { id: "all", label: "All Products", test: function () { return true; } },
    { id: "protein", label: "Protein", test: function (value) { return /protein|whey|isolate|casein|gainer/.test(value); } },
    { id: "creatine", label: "Creatine", test: function (value) { return /creatine/.test(value); } },
    { id: "pre-workout", label: "Pre-Workout", test: function (value) { return /pre.?workout|pump|nitric|focus|stim|energy/.test(value); } },
    { id: "hydration", label: "Hydration", test: function (value) { return /hydration|electrolyte|drink|intra workout/.test(value); } },
    { id: "amino-acids", label: "Amino Acids", test: function (value) { return /amino|bcaa|eaa/.test(value); } },
    { id: "greens", label: "Greens", test: function (value) { return /greens|reds|superfoods/.test(value); } },
    { id: "bars-shakes", label: "Bars & Shakes", test: function (value) { return /bars? ?& ?shakes?|bars, shakes|meal replacement|ready to drink|rtd|cookie/.test(value); } },
    { id: "daily-health", label: "Daily Health", test: function (value) { return /daily health|vitamin|wellness|multivitamin|mineral|support/.test(value); } },
    { id: "sleep-recovery", label: "Sleep", test: function (value) { return /sleep|nighttime/.test(value); } },
    { id: "recovery", label: "Recovery", test: function (value) { return /recovery|glutamine/.test(value) && !/sleep recovery|recovery device/.test(value); } }
  ];

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function normalized(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
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
      product.slug,
      product.url,
      product.wholesale_category_slug
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isExcludedSupplementProduct(product) {
    var value = productText(product);
    var name = String(product.name || product.title || "").toLowerCase();
    if (/training apparel|gym accessor(?:y|ies)|training gear/.test(value)) return true;
    if (/recovery device/.test(value) && !/amino|bcaa|eaa|hydration|electrolyte|glutamine/.test(name)) return true;
    return /\bbundles?\b|\bvariety packs?\b|\bpacks?\b|\bduos?\b|\bstack\b|\bcombos?\b|\bcollections?\b|\bsets?\b|\bkits?\b|\bsamplers?\b|\bsamples?\b|\bsubscriptions?\b|\bmix[ -]?and[ -]?match\b|\bbuild[ -]?a\b|\bcase of\b|\bcases?\b|\bairpods?\b|\bmulti[ -]?buy\b|\be-?books?\b|\bsample pack(?:et)?s?\b|\bbogo\b|\bbuy (?:two|three|2|3)\b|\b(?:2|3) for\b|\bfree (?:gift|shaker|bottle|product)\b|\bgifts? with purchase\b|\bt-?shirts?\b|\btees?\b|\bshirts?\b|\bsweat(?:pants?|spants?|s)?\b|\bhoodies?\b|\bflannels?\b|\bbeanies?\b|\bhats?\b|\bcaps?\b|\bsnapbacks?\b|\btruckers?\b|\btank(?: tops?)?\b|\blong sleeves?\b|\bcrew ?necks?\b|\bpullovers?\b|\bzip[ -]?ups?\b|\bquarter zips?\b|\bjackets?\b|\bapparel\b|\bshorts?\b|\bjoggers?\b|\bleggings?\b|\bsports bras?\b|\bsmartshakes?\b|\bice shakers?\b|\bshakers?\b|\bblenderbottles?\b|\bwater bottles?\b|\bbottles?\b|\bjugs?\b|\byoga mats?\b|\bfanny packs?\b|\bgym bags?\b|\bduffels?\b|\bbackpacks?\b|\bdrawstrings?\b|\bknee sleeves?\b|\belbow sleeves?\b|\bweight belts?\b|\bgrip pads?\b|\bgrips?\b|\bwraps?\b|\bstraps?\b|\bgloves?\b|\bsocks?\b|\btowels?\b|\bheadbands?\b|\bwristbands?\b|\bposters?\b|\bstickers?\b|\blanyards?\b|\bgift cards?\b|\bmerch(?:andise)?\b|\baccessor(?:y|ies)\b|\bkeychains?\b|\bwallets?\b|\bpatch(?:es)?\b|\bflags?\b|\bbanners?\b|\bfunnels?\b|\bscoops?\b|\brewards?\b|\bwaist trimmers?\b|\bdefining gels?\b/.test(value);
  }

  var redundantAllmaxRetailIds = new Set([
    // These legacy cards reuse the same sellable SKUs as the current combined
    // Vitaform PDP and the size-specific Isoflex 10 Packets PDP.
    "allmax-allmax-vitaform-men-multivitamin",
    "allmax-allmax-vitaform-multivitamin-women",
    "allmax-allmax-isoflex-100-whey-protein-isolate-packet"
  ]);

  function isRedundantAllmaxProduct(product) {
    return brandSlug === "allmax" && redundantAllmaxRetailIds.has(String(product.id || ""));
  }

  function money(cents) {
    return "$" + (Number(cents || 0) / 100).toFixed(2);
  }

  function productImage(product) {
    var raw = product.image_url || product.image || "";
    if (!raw && Array.isArray(product.images) && product.images.length) raw = product.images[0].url || product.images[0];
    if (!raw && Array.isArray(product.gallery) && product.gallery.length) raw = product.gallery[0].url || product.gallery[0];
    return raw || "../assets/logo.png";
  }

  function productUrl(product) {
    var productId = product.retail_product_id || product.id || product.slug || product.product_id || "";
    var url = "/product/" + encodeURIComponent(productId);
    return product.presentation_variant_id
      ? url + "?variant=" + encodeURIComponent(product.presentation_variant_id)
      : url;
  }

  function catalogUrl(value) {
    return String(value || "").trim().toLowerCase().replace(/\/$/, "");
  }

  function wholesaleUrlKey(product) {
    return [String(product.brand_slug || "").trim().toLowerCase(), catalogUrl(product.url)].join("::");
  }

  function productCategoryLabel(product) {
    var sourceCategory = String(product.wholesale_category_slug || "").trim().toLowerCase();
    var name = String(product.name || product.title || "").toLowerCase();
    if (sourceCategory === "recovery" && /eaa.*hydration|hydration.*eaa/.test(name)) return "Amino Acids & Hydration";
    if (sourceCategory === "recovery" && /amino|bcaa|eaa/.test(name)) return "Amino Acids";
    if (sourceCategory === "recovery") return "Recovery";
    return product.section_title || product.category_name || product.category || "Supplements";
  }

  var nutrexCreatine1000Image = "https://cdn.shopify.com/s/files/1/0556/9750/6368/files/Creatine-200-B-FR.png";

  function nutrexCreatinePresentations(product, wholesaleProducts) {
    if (brandSlug !== "nutrex" || String(product.id || "") !== "14673") return [product];

    var variantsById = new Map((product.variants || []).map(function (variant) {
      return [String(variant.variant_id || variant.id || ""), variant];
    }));
    var rows = wholesaleProducts.filter(function (wholesaleProduct) {
      return catalogUrl(wholesaleProduct.url) === catalogUrl(product.url) &&
        /^creatine monohydrate - \d+\s*g$/i.test(String(wholesaleProduct.name || "").trim());
    });

    return rows.map(function (row) {
      var wholesaleVariant = Array.isArray(row.variants) ? row.variants[0] : null;
      var variantId = String(wholesaleVariant && (wholesaleVariant.id || wholesaleVariant.variant_id) || "");
      var retailVariant = variantsById.get(variantId);
      if (!retailVariant) return null;
      var size = String(retailVariant.selected_options && retailVariant.selected_options.Size || retailVariant.title || "").trim();
      var displaySize = size === "1000 g" ? "1000 g / 1 kg" : size === "2000 g" ? "2000 g / 2 kg" : size;
      var image = variantId === "39867272429632"
        ? nutrexCreatine1000Image
        : String(retailVariant.image_url || product.image_url || product.image || "");
      var variant = Object.assign({}, retailVariant, { image_url: image });
      return Object.assign({}, product, {
        id: String(row.id || product.id + "-" + normalized(size).replace(/\s+/g, "-")),
        retail_product_id: String(product.id),
        presentation_variant_id: variantId,
        name: "Creatine Monohydrate - " + displaySize,
        image_url: image,
        price_cents: Number(retailVariant.price_cents || product.price_cents || 0),
        variants: [variant]
      });
    }).filter(Boolean);
  }

  function categoryRank(product) {
    var value = productText(product);
    for (var index = 1; index < categories.length; index += 1) {
      if (categories[index].test(value)) return index;
    }
    return 999;
  }

  function compareProducts(a, b) {
    var rank = categoryRank(a) - categoryRank(b);
    if (rank) return rank;
    return String(a.name || a.title || "").localeCompare(String(b.name || b.title || ""));
  }

  function productCard(product) {
    var name = product.name || product.title || "Product";
    var variants = Array.isArray(product.variants) ? product.variants.length : 0;
    var url = productUrl(product);
    var price = Number(product.price_cents || product.retail_price_cents || 0);
    var compareAt = Number(product.compare_at_price_cents || 0);
    var promoted = compareAt > price;
    var variantTitles = Array.isArray(product.variants) ? product.variants.map(function (variant) {
      return String(variant.title || "").trim();
    }).filter(Boolean) : [];
    var variantSummary = variantTitles.length > 1
      ? '<p class="product-variant-summary">' + escapeHtml(variantTitles.join(" · ")) + '</p>'
      : "";
    var priceLine = '<div class="product-price-line">' +
      (promoted ? '<s>' + money(compareAt) + '</s>' : '') +
      '<strong>' + money(price) + '</strong>' +
      (promoted ? '<span class="deal-pct">20% off</span>' : '') +
      '</div>';
    return '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '"' +
      (product.presentation_variant_id ? ' data-variant-id="' + escapeHtml(product.presentation_variant_id) + '"' : "") +
      ' data-search="' + escapeHtml(productText(product)) + '">' +
      '<a class="product-image" href="' + escapeHtml(url) + '"><img src="' + escapeHtml(productImage(product)) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async" /></a>' +
      '<div class="product-body"><span>' + escapeHtml(brandName) + '</span>' +
      '<h3><a class="product-card-link" href="' + escapeHtml(url) + '">' + escapeHtml(name) + '</a></h3>' +
      '<p>' + escapeHtml(productCategoryLabel(product)) + '</p>' +
      variantSummary +
      priceLine +
      '<a class="add-cart-button product-options-button" href="' + escapeHtml(url) + '">' +
      (variants > 1 ? "View options" : "View product") +
      "</a></div></article>";
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
    var query = normalized(input && input.value || "");
    var searched = query
      ? products.filter(function (product) { return normalized(productText(product)).indexOf(query) !== -1; })
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
    var details = menu.querySelector("details");
    if (details) details.removeAttribute("open");
  });

  if (input) input.addEventListener("input", render);
  if (clear) {
    clear.addEventListener("click", function () {
      input.value = "";
      render();
      input.focus();
    });
  }

  Promise.all([
    fetch("../data/wholesale-supplements-catalog.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Wholesale catalog HTTP " + response.status);
      return response.json();
    }),
    fetch("../data/final/catalog.published.json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Retail catalog HTTP " + response.status);
      return response.json();
    })
  ])
    .then(function (payloads) {
      var wholesalePayload = payloads[0];
      var retailPayload = payloads[1];
      var wholesaleProducts = Array.isArray(wholesalePayload) ? wholesalePayload : wholesalePayload.products || [];
      var retailProducts = Array.isArray(retailPayload) ? retailPayload : retailPayload.products || [];
      var wholesaleForBrand = wholesaleProducts.filter(function (product) {
        return String(product.brand_slug || "").trim().toLowerCase() === brandSlug;
      });
      var wholesaleByUrl = new Map(wholesaleForBrand.map(function (product) {
        return [wholesaleUrlKey(product), product];
      }));

      var seenRetailProducts = new Set();
      products = retailProducts.filter(function (product) {
        if (String(product.brand_slug || "").trim().toLowerCase() !== brandSlug) return false;
        if (isRedundantAllmaxProduct(product)) return false;
        if (isExcludedSupplementProduct(product)) return false;
        var sectionId = String(product.section_id || "").trim().toLowerCase();
        if (/^(apparel|training-gear|shoes|accessories)$/.test(sectionId)) return false;
        if (sectionId === "recovery") {
          var recoveryMatch = wholesaleByUrl.get(wholesaleUrlKey(product));
          var recoveryCategory = recoveryMatch ? String(recoveryMatch.category_slug || "").trim() : "";
          if (!/amino|recovery|hydration|bcaa|eaa|glutamine/.test((recoveryCategory + " " + String(product.name || "")).toLowerCase())) return false;
        }
        var dedupeKey = String(product.id || "").trim() || wholesaleUrlKey(product) || normalized(product.name);
        if (!dedupeKey || seenRetailProducts.has(dedupeKey)) return false;
        seenRetailProducts.add(dedupeKey);
        return true;
      }).map(function (product) {
        var wholesaleMatch = wholesaleByUrl.get(wholesaleUrlKey(product));
        return Object.assign({}, product, {
          wholesale_category_slug: wholesaleMatch ? String(wholesaleMatch.category_slug || "").trim() : ""
        });
      }).flatMap(function (product) {
        return nutrexCreatinePresentations(product, wholesaleForBrand);
      }).sort(compareProducts);
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
