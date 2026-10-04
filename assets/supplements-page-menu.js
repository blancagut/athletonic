(function () {
  "use strict";

  if (!document.body || document.body.dataset.supplementsIndex !== "true") return;

  var finder = document.querySelector(".listing-finder");
  var sections = document.querySelector(".listing-sections");
  var input = document.querySelector("[data-listing-filter]");
  var clear = document.querySelector("[data-listing-clear]");
  var count = document.querySelector("[data-listing-count]");
  var empty = document.querySelector("[data-listing-empty]");
  if (!finder || !sections || !input || !count) return;

  var PERFORMANCE_BRANDS = [
    { slug: "mhp", name: "MHP", page: "/mhp", logo: "/assets/brands/mhp-logo.png" },
    { slug: "isopure", name: "Isopure", page: "/isopure", logo: "/assets/brands/isopure-logo.svg" },
    { slug: "dymatize", name: "Dymatize", page: "/dymatize", logo: "/assets/brands/dymatize-logo.svg" },
    { slug: "bsn", name: "BSN", page: "/bsn", logo: "/assets/brands/bsn-logo.svg" },
    { slug: "gat", name: "GAT Sport", page: "/gat", logo: "/assets/brands/gat-logo.png" },
    { slug: "optimum_nutrition", name: "Optimum Nutrition", page: "/optimum-nutrition", logo: "/assets/brands/Optimum-Nutrition-Logo.png" },
    { slug: "muscletech", name: "MuscleTech", page: "/muscletech", logo: "/assets/brands/muscletech%20-%20logo.png" },
    { slug: "animal_pak", name: "Animal", page: "/animal", logo: "/assets/brands/animal-logo.png" },
    { slug: "cellucor", name: "Cellucor", page: "/cellucor", logo: "/assets/brands/cellucor-logo.svg?v=20260811-2" },
    { slug: "nutrabio", name: "NutraBio", page: "/nutrabio", logo: "/assets/brands/nutrabio-logo.svg" },
    { slug: "myprotein", name: "Myprotein", page: "/myprotein", logo: "/assets/brands/myprotein-logo.jpg" },
    { slug: "musclepharm", name: "MusclePharm", page: "/musclepharm", logo: "/assets/brands/musclepharm-logo.png" },
    { slug: "redcon1", name: "Redcon1", page: "/redcon1", logo: "/assets/brands/redcon1-logo.svg" },
    { slug: "raw_nutrition", name: "RAW Nutrition", page: "/raw-nutrition", logo: "/assets/brands/raw_nutrition-logo.svg" },
    { slug: "ryse_supplements", name: "RYSE", page: "/ryse-supplements", logo: "/assets/brands/ryse_supplements-logo.png" },
    { slug: "kaged", name: "Kaged", page: "/kaged", logo: "/assets/brands/kaged-logo.png" },
    { slug: "jym", name: "JYM", page: "/jym", logo: "/assets/brands/jym-logo.png" },
    { slug: "pescience", name: "PEScience", page: "/pescience", logo: "/assets/brands/pescience-logo.png" },
    { slug: "ghost_lifestyle", name: "Ghost Lifestyle", page: "/ghost", logo: "/assets/brands/ghost-logo.png" },
    { slug: "glaxon", name: "Glaxon", page: "/glaxon", logo: "/assets/brands/glaxon-logo.png" },
    { slug: "gorilla_mind", name: "Gorilla Mind", page: "/gorilla-mind", logo: "/assets/brands/gorilla_mind-logo.svg" },
    { slug: "huge_supplements", name: "Huge Supplements", page: "/huge-supplements", logo: "/assets/brands/huge_supplements-logo.png" },
    { slug: "alpha_lion", name: "Alpha Lion", page: "/alpha-lion", logo: "/assets/brands/alpha_lion-logo.png" },
    { slug: "bucked_up", name: "Bucked Up", page: "/bucked-up", logo: "/assets/brands/bucked_up-logo.png" },
    { slug: "black_magic_supps", name: "Black Magic Supps", page: "/black-magic-supps", logo: "/assets/brands/black_magic_supps-logo.png" },
    { slug: "jacked_factory", name: "Jacked Factory", page: "/jacked-factory", logo: "/assets/brands/jacked_factory-logo.png" },
    { slug: "core_nutritionals", name: "Core Nutritionals", page: "/core-nutritionals", logo: "/assets/brands/core_nutritionals-logo.svg" },
    { slug: "bare_performance", name: "Bare Performance Nutrition", page: "/bare-performance", logo: "/assets/brands/bare_performance-logo.svg" },
    { slug: "promix", name: "Promix", page: "/promix", logo: "/assets/brands/promix-logo.png" },
    { slug: "quest_nutrition", name: "Quest Nutrition", page: "/quest-nutrition", logo: "/assets/brands/quest_nutrition-logo.png" },
    { slug: "transparent_labs", name: "Transparent Labs", page: "/transparent-labs", logo: "/assets/brands/transparent_labs-logo.png" },
    { slug: "nutrex", name: "Nutrex", page: "/nutrex", logo: "/assets/brands/nutrex-logo.svg" },
    { slug: "swolverine", name: "Swolverine", page: "/swolverine", logo: "/assets/brands/swolverine-logo.png" }
  ];

  var BRAND_BY_SLUG = new Map(PERFORMANCE_BRANDS.map(function (brand) { return [brand.slug, brand]; }));
  var BRAND_SET = new Set(PERFORMANCE_BRANDS.map(function (brand) { return brand.slug; }));
  // Retail products are the source of truth for the storefront. Wholesale is
  // used only to identify supplement brands/categories, never as a row-level
  // join: product names and URLs legitimately differ between the two feeds.
  var SUPPLEMENT_SECTION_IDS = new Set([
    "protein", "pre-workout", "pre_workout", "hydration", "bars-shakes",
    "sleep", "creatine", "vitamins", "supplements", "greens",
    "amino_acids", "amino-acids", "sample_packets", "vitamins_wellness",
    "ready_to_drink"
  ]);
  var NON_SUPPLEMENT_SECTION_IDS = new Set([
    "apparel", "training-gear", "shoes", "accessories", "recovery"
  ]);
  var CATEGORY_CONFIG = [
    { id: "protein", label: "Protein", href: "/protein", source: ["protein", "mass_gainers"] },
    { id: "creatine", label: "Creatine", href: "/creatine", source: ["creatine"] },
    { id: "pre-workout", label: "Pre-Workout", href: "/pre-workout", source: ["pre_workout", "focus_mood"] },
    { id: "hydration", label: "Hydration", href: "/hydration", source: ["energy_hydration"] },
    { id: "amino-acids", label: "Amino Acids", href: "/recovery", source: ["amino_acids"] },
    { id: "greens", label: "Greens", href: "/greens", source: ["greens_superfoods"] },
    { id: "bars-shakes", label: "Bars & Shakes", href: "/bars-shakes", source: ["protein_bars", "rtd_shakes", "ready_to_drink", "meal_replacement", "snacks"] },
    { id: "daily-health", label: "Daily Health / Vitamins", href: "/vitamins", source: ["vitamins_minerals", "multivitamins", "immune_support", "omega_fish_oil", "joint_support", "hair_skin_nails", "hormone_support", "collagen_beauty", "vitamins_wellness"] },
    { id: "sleep", label: "Sleep", href: "/sleep-supplements", source: ["sleep_stress"] },
    { id: "recovery", label: "Recovery", href: "/recovery", source: ["recovery"] },
    { id: "weight-management", label: "Weight Management", href: "/lose-fat", source: ["weight_management"] },
    { id: "gut-health", label: "Gut Health", href: "/daily-wellness", source: ["gut_health"] },
    { id: "longevity", label: "Longevity", href: "/daily-wellness", source: ["longevity", "adaptogens_herbals"] }
  ];

  var CATEGORY_BY_SOURCE = new Map();
  CATEGORY_CONFIG.forEach(function (category) {
    category.source.forEach(function (sourceKey) {
      CATEGORY_BY_SOURCE.set(sourceKey, category.id);
    });
  });

  var products = [];
  var pageSize = 12;
  var homeOnly = document.body.dataset.homeSupplements === "true";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalized(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function money(cents) {
    return "$" + (Number(cents || 0) / 100).toFixed(2);
  }

  function compareByName(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
  }

  function isExcludedSupplementProduct(product) {
    var value = productText(product);
    var name = String(product.name || product.title || "").toLowerCase();
    if (/training apparel|gym accessor(?:y|ies)|training gear/.test(value)) return true;
    if (/recovery device/.test(value) && !/amino|bcaa|eaa|hydration|electrolyte|glutamine/.test(name)) return true;
    return /\bbundles?\b|\bvariety packs?\b|\bpacks?\b|\bduos?\b|\bstack\b|\bcombos?\b|\bcollections?\b|\bsets?\b|\bkits?\b|\bsamplers?\b|\bsamples?\b|\bsubscriptions?\b|\bmix[ -]?and[ -]?match\b|\bbuild[ -]?a\b|\bcase of\b|\bcases?\b|\bairpods?\b|\bmulti[ -]?buy\b|\be-?books?\b|\bsample pack(?:et)?s?\b|\bbogo\b|\bbuy (?:two|three|2|3)\b|\b(?:2|3) for\b|\bfree (?:gift|shaker|bottle|product)\b|\bgifts? with purchase\b|\bt-?shirts?\b|\btees?\b|\bshirts?\b|\bsweat(?:pants?|spants?|s)?\b|\bhoodies?\b|\bflannels?\b|\bbeanies?\b|\bhats?\b|\bcaps?\b|\bsnapbacks?\b|\btruckers?\b|\btank(?: tops?)?\b|\blong sleeves?\b|\bcrew ?necks?\b|\bpullovers?\b|\bzip[ -]?ups?\b|\bquarter zips?\b|\bjackets?\b|\bapparel\b|\bshorts?\b|\bjoggers?\b|\bleggings?\b|\bsports bras?\b|\bsmartshakes?\b|\bice shakers?\b|\bshakers?\b|\bblenderbottles?\b|\bwater bottles?\b|\bbottles?\b|\bjugs?\b|\byoga mats?\b|\bfanny packs?\b|\bgym bags?\b|\bduffels?\b|\bbackpacks?\b|\bdrawstrings?\b|\bknee sleeves?\b|\belbow sleeves?\b|\bweight belts?\b|\bgrip pads?\b|\bgrips?\b|\bwraps?\b|\bstraps?\b|\bgloves?\b|\bsocks?\b|\btowels?\b|\bheadbands?\b|\bwristbands?\b|\bposters?\b|\bstickers?\b|\blanyards?\b|\bgift cards?\b|\bmerch(?:andise)?\b|\baccessor(?:y|ies)\b|\bkeychains?\b|\bwallets?\b|\bpatch(?:es)?\b|\bflags?\b|\bbanners?\b|\bfunnels?\b|\bscoops?\b|\brewards?\b|\bwaist trimmers?\b|\bdefining gels?\b/.test(value);
  }

  function categoryFromSource(sourceKey) {
    return CATEGORY_BY_SOURCE.get(String(sourceKey || "").trim()) || "other";
  }

  function categoryLabel(categoryId) {
    var match = CATEGORY_CONFIG.find(function (item) { return item.id === categoryId; });
    return match ? match.label : "Other";
  }

  function categoryPageHref(categoryId) {
    var match = CATEGORY_CONFIG.find(function (item) { return item.id === categoryId; });
    return match ? match.href : "/supplements";
  }

  function localProductUrl(product) {
    var productId = product.retail_product_id || product.id || product.slug || "";
    var url = "/product/" + encodeURIComponent(productId);
    return product.presentation_variant_id
      ? url + "?variant=" + encodeURIComponent(product.presentation_variant_id)
      : url;
  }

  function productImage(product) {
    if (product.image) return product.image;
    if (product.image_url) return product.image_url;
    if (Array.isArray(product.variants)) {
      var withImage = product.variants.find(function (variant) { return variant && variant.image_url; });
      if (withImage) return withImage.image_url;
    }
    return "../assets/logo.png";
  }

  function productText(product) {
    return [
      product.name,
      product.brand,
      product.brandName,
      product.section_title,
      product.wholesale_category_slug,
      product.id,
      product.url
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function wholesaleLookupKey(brandSlug, name, url) {
    return [String(brandSlug || "").trim().toLowerCase(), String(name || "").trim().toLowerCase(), String(url || "").trim().toLowerCase()].join("::");
  }

  function wholesaleNameKey(brandSlug, name) {
    return [String(brandSlug || "").trim().toLowerCase(), String(name || "").trim().toLowerCase()].join("::");
  }

  function wholesaleUrlKey(brandSlug, url) {
    return [String(brandSlug || "").trim().toLowerCase(), String(url || "").trim().toLowerCase().replace(/\/$/, "")].join("::");
  }

  var nutrexCreatine1000Image = "https://cdn.shopify.com/s/files/1/0556/9750/6368/files/Creatine-200-B-FR.png";

  function nutrexCreatinePresentations(product, wholesaleProducts) {
    if (String(product.brand_slug || "") !== "nutrex" || String(product.id || "") !== "14673") return [product];

    var variantsById = new Map((product.variants || []).map(function (variant) {
      return [String(variant.variant_id || variant.id || ""), variant];
    }));
    var rows = wholesaleProducts.filter(function (wholesaleProduct) {
      return String(wholesaleProduct.brand_slug || "") === "nutrex" &&
        wholesaleUrlKey("nutrex", wholesaleProduct.url) === wholesaleUrlKey("nutrex", product.url) &&
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
      return Object.assign({}, product, {
        id: String(row.id),
        retail_product_id: String(product.id),
        presentation_variant_id: variantId,
        name: "Creatine Monohydrate - " + displaySize,
        image_url: image,
        price_cents: Number(retailVariant.price_cents || product.price_cents || 0),
        variants: [Object.assign({}, retailVariant, { image_url: image })]
      });
    }).filter(Boolean);
  }

  function productCard(product, index) {
    var url = localProductUrl(product);
    var variantCount = Array.isArray(product.variants) ? product.variants.length : 0;
    var price = Number(product.price_cents || product.retail_price_cents || 0);
    return '<article class="product-card" data-listing-index="' + index + '" data-product-id="' + escapeHtml(product.id) + '" data-category="' + escapeHtml(product.public_category) + '" data-search="' + escapeHtml(productText(product)) + '">' +
      '<a class="product-image" href="' + escapeHtml(url) + '">' +
      '<img src="' + escapeHtml(productImage(product)) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async" />' +
      "</a>" +
      '<div class="product-body"><span>' + escapeHtml(product.brandName) + '</span>' +
      '<h3><a class="product-card-link" href="' + escapeHtml(url) + '">' + escapeHtml(product.name) + "</a></h3>" +
      "<p>" + escapeHtml(categoryLabel(product.public_category)) + "</p>" +
      '<div class="product-price-line"><strong>' + money(price) + "</strong></div>" +
      '<a class="add-cart-button product-options-button" href="' + escapeHtml(url) + '">' + (variantCount > 1 ? "View options" : "View product") + "</a>" +
      "</div></article>";
  }

  function renderMenus(wholesaleCategoryIds) {
    var categories = CATEGORY_CONFIG.filter(function (category) {
      return category.source.some(function (sourceKey) {
        return wholesaleCategoryIds.has(sourceKey);
      });
    });

    var menus = document.createElement("div");
    menus.className = "supplements-discovery-menus";
    menus.innerHTML =
      '<nav class="collection-category-menu" aria-label="Shop supplement categories">' +
        '<details class="brand-category-menu"><summary>Shop by category</summary><div class="brand-category-menu-panel">' +
          categories.map(function (item) { return '<a href="' + item.href + '">' + escapeHtml(item.label) + "</a>"; }).join("") +
        "</div></details>" +
      "</nav>" +
      '<nav class="collection-category-menu" aria-label="Shop supplement brands">' +
        '<a class="supplements-brand-directory-link" href="/brands">Brands</a>' +
      "</nav>";

    finder.insertAdjacentElement("afterend", menus);

    menus.addEventListener("click", function (event) {
      if (!event.target.closest("a")) return;
      Array.prototype.forEach.call(menus.querySelectorAll("details[open]"), function (details) {
        details.removeAttribute("open");
      });
    });
  }

  function renderSections() {
    var byBrand = new Map();

    products.forEach(function (product) {
      var list = byBrand.get(product.brand_slug) || [];
      list.push(product);
      byBrand.set(product.brand_slug, list);
    });

    var brands = Array.from(byBrand.keys()).map(function (slug) {
      return BRAND_BY_SLUG.get(slug) || {
        slug: slug,
        name: String(slug || "").replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }),
        page: "/supplements",
        logo: "/assets/logo.png"
      };
    }).sort(function (a, b) {
      var ai = PERFORMANCE_BRANDS.findIndex(function (brand) { return brand.slug === a.slug; });
      var bi = PERFORMANCE_BRANDS.findIndex(function (brand) { return brand.slug === b.slug; });
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    sections.innerHTML = brands.map(function (brand) {
      var items = (byBrand.get(brand.slug) || []).sort(compareByName);
      if (homeOnly) items = items.slice(0, 4);
      return '<section class="market-section listing-section" id="' + escapeHtml(brand.page.slice(1)) + '">' +
        '<div class="section-title supplement-brand-section-title"><h2 class="supplement-brand-heading">' +
        '<a href="' + escapeHtml(brand.page) + '" aria-label="' + escapeHtml(brand.name) + '">' +
        '<img src="' + escapeHtml(brand.logo) + '" alt="' + escapeHtml(brand.name) + '" width="180" height="64" />' +
        '<span class="brand-live-title">' + escapeHtml(brand.name) + "</span></a></h2></div>" +
        '<div class="product-row" data-listing-shelf-grid>' + items.map(productCard).join("") + "</div>" +
        (items.length > pageSize
          ? '<div class="listing-shelf-footer"><p><span data-listing-shelf-shown>' + pageSize + "</span> of " + items.length + ' shown</p><button type="button" class="add-cart-button" data-listing-load-more>Load more</button></div>'
          : "") +
        "</section>";
    }).join("");

  }

  function applyFilter() {
    var query = normalized(input.value);
    var visibleCount = 0;

    Array.prototype.forEach.call(sections.querySelectorAll(".listing-section"), function (shelf) {
      var cards = Array.prototype.slice.call(shelf.querySelectorAll(".product-card"));
      var shown = Number(shelf.dataset.listingShown || pageSize);
      var matchingTotal = 0;

      cards.forEach(function (card) {
        var matches = !query || normalized(card.dataset.search).indexOf(query) !== -1;
        if (matches) matchingTotal += 1;
        var withinPage = query || Number(card.dataset.listingIndex || 0) < shown;
        card.hidden = !(matches && withinPage);
        if (matches && withinPage) visibleCount += 1;
      });

      shelf.hidden = matchingTotal === 0;

      var footer = shelf.querySelector(".listing-shelf-footer");
      var shownText = shelf.querySelector("[data-listing-shelf-shown]");
      var button = shelf.querySelector("[data-listing-load-more]");
      if (shownText) shownText.textContent = String(query ? matchingTotal : Math.min(shown, matchingTotal));
      if (footer) footer.hidden = Boolean(query);
      if (button) button.hidden = Boolean(query) || shown >= matchingTotal;
    });

    if (empty) empty.hidden = visibleCount !== 0;
    count.textContent = query
      ? visibleCount + " product" + (visibleCount === 1 ? "" : "s") + " found"
      : count.dataset.listingTotal + " products in this collection";
  }

  function bindEvents() {
    Array.prototype.forEach.call(sections.querySelectorAll("[data-listing-load-more]"), function (button) {
      button.addEventListener("click", function () {
        var shelf = button.closest(".listing-section");
        shelf.dataset.listingShown = String(Number(shelf.dataset.listingShown || pageSize) + pageSize);
        applyFilter();
      });
    });

    input.addEventListener("input", applyFilter);
    if (clear) {
      clear.addEventListener("click", function () {
        input.value = "";
        applyFilter();
        input.focus();
      });
    }
  }

  function load() {
    Promise.all([
      fetch("../data/wholesale-supplements-catalog.json", { cache: "no-store" }).then(function (response) { return response.json(); }),
      fetch("../data/final/catalog.published.json", { cache: "no-store" }).then(function (response) { return response.json(); })
    ]).then(function (payloads) {
      var wholesalePayload = payloads[0];
      var retailPayload = payloads[1];
      var wholesaleProducts = Array.isArray(wholesalePayload) ? wholesalePayload : wholesalePayload.products || [];
      var retailProducts = Array.isArray(retailPayload) ? retailPayload : retailPayload.products || [];
      var wholesaleSupplementBrands = new Set(wholesaleProducts.filter(function (product) {
        return String(product.category_slug || "").trim() !== "accessories";
      }).map(function (product) {
        return String(product.brand_slug || "").trim();
      }).filter(Boolean));
      // Keep the configured order for known performance brands, then include
      // every additional supplement brand present in the published catalog.
      var wholesalePerformance = wholesaleProducts.filter(function (product) {
        return wholesaleSupplementBrands.has(String(product.brand_slug || "").trim());
      });
      var wholesaleByKey = new Map(wholesalePerformance.map(function (product) {
        return [wholesaleLookupKey(product.brand_slug, product.name, product.url), product];
      }));
      var wholesaleByName = new Map(wholesalePerformance.map(function (product) {
        return [wholesaleNameKey(product.brand_slug, product.name), product];
      }));
      var wholesaleByUrl = new Map(wholesalePerformance.map(function (product) {
        return [wholesaleUrlKey(product.brand_slug, product.url), product];
      }));
      var wholesaleCategoryIds = new Set(wholesalePerformance.map(function (product) { return String(product.category_slug || "").trim(); }).filter(Boolean));

      products = retailProducts.filter(function (product) {
        var brandSlug = String(product.brand_slug || "").trim();
        if (!wholesaleSupplementBrands.has(brandSlug)) return false;
        var sectionId = String(product.section_id || "").trim();
        var recoverySupplement = sectionId === "recovery" && /amino|bcaa|eaa|hydration|electrolyte|glutamine/i.test(String(product.name || ""));
        if (NON_SUPPLEMENT_SECTION_IDS.has(sectionId) && !recoverySupplement) return false;
        return !isExcludedSupplementProduct(product);
      }).map(function (product) {
        var brand = BRAND_BY_SLUG.get(String(product.brand_slug || "").trim());
        var wholesaleMatch = wholesaleByUrl.get(wholesaleUrlKey(product.brand_slug, product.url)) ||
          wholesaleByKey.get(wholesaleLookupKey(product.brand_slug, product.name, product.url)) ||
          wholesaleByName.get(wholesaleNameKey(product.brand_slug, product.name));
        var wholesaleCategorySlug = wholesaleMatch ? String(wholesaleMatch.category_slug || "").trim() : "";
        var productCategory = categoryFromSource(wholesaleCategorySlug);
        if (productCategory === "other") {
          var sectionId = String(product.section_id || "").trim();
          productCategory = sectionId === "pre_workout" ? "pre-workout" :
            sectionId === "vitamins" || sectionId === "supplements" ? "daily-health" :
            sectionId === "bars-shakes" ? "bars-shakes" :
            sectionId === "amino_acids" ? "amino-acids" :
            sectionId === "ready_to_drink" ? "bars-shakes" : sectionId;
        }
        return Object.assign({}, product, {
          brandName: brand ? brand.name : product.brand || "",
          wholesale_category_slug: wholesaleCategorySlug,
          public_category: productCategory
        });
      }).flatMap(function (product) {
        return nutrexCreatinePresentations(product, wholesalePerformance);
      });

      products.sort(function (a, b) {
        var brandOrder = PERFORMANCE_BRANDS.findIndex(function (brand) { return brand.slug === a.brand_slug; }) -
          PERFORMANCE_BRANDS.findIndex(function (brand) { return brand.slug === b.brand_slug; });
        if (brandOrder) return brandOrder;
        return compareByName(a, b);
      });

      count.dataset.listingTotal = String(products.length);
      count.textContent = products.length + " products in this collection";
      renderMenus(wholesaleCategoryIds);
      renderSections();
      Array.prototype.forEach.call(sections.querySelectorAll(".listing-section"), function (shelf) {
        shelf.dataset.listingShown = String(pageSize);
      });
      bindEvents();
      applyFilter();
    }).catch(function () {
      sections.innerHTML = "";
      count.textContent = "Could not load supplements.";
      if (empty) empty.hidden = false;
    });
  }

  load();
})();
