"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const catalogData = require("../data/athletonic-catalog.json");
const searchIndexData = require("../data/search-index.json");

const PRODUCT_DIR = path.join(__dirname, "..", "product");
const BANNED_COPY_RE = /\bAmazon US\b|\bverified Amazon\b/i;
const SAMPLE_SIZE = 3;
const VARIANT_REGRESSION_PRODUCT_IDS = ["443", "480", "109", "595"];
const VARIANT_IMAGE_CASES = {
  "443": ["52926938513726", "52926938546494", "52926938579262"],
  "480": ["52799977619774", "52799977652542", "52799977685310"],
  "109": ["44497917902893", "42993190993965", "43119324299309"],
  "595": ["52061146710334", "52061146743102", "52061146775870"],
};

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(text) {
  return decodeEntities(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatUsdFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents) / 100);
}

function readProductHtml(productId) {
  return readFileSync(path.join(PRODUCT_DIR, `${productId}.html`), "utf8");
}

function hasProductHtml(productId) {
  return existsSync(path.join(PRODUCT_DIR, `${productId}.html`));
}

function parseJsonAssignment(html, variableName) {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`var ${escapedName} = (\\[[\\s\\S]*?\\]);`));
  assert.ok(match, `expected ${variableName} payload in PDP html`);
  return JSON.parse(match[1].replace(/\\u003c/g, "<"));
}

function parseAddButtonDataset(html) {
  const match = html.match(/<button\b[^>]*data-pdp-add-button\b([\s\S]*?)>/i);
  assert.ok(match, "expected PDP add-to-cart button");
  const attrs = {};
  const attrRe = /\b(data-[a-z0-9-]+)="([^"]*)"/gi;
  let attrMatch;
  while ((attrMatch = attrRe.exec(match[1]))) {
    attrs[attrMatch[1]] = decodeEntities(attrMatch[2]);
  }
  return attrs;
}

function parseVariantSelects(html) {
  const selects = [];
  const selectRe =
    /<select\b[^>]*data-pdp-variant\b[^>]*data-variant-name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi;
  let selectMatch;
  while ((selectMatch = selectRe.exec(html))) {
    const values = [];
    const optionRe = /<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
    let optionMatch;
    while ((optionMatch = optionRe.exec(selectMatch[2]))) {
      const value = decodeEntities(optionMatch[1]).trim();
      if (!value) continue;
      values.push(value);
    }
    selects.push({
      name: decodeEntities(selectMatch[1]).trim(),
      values,
    });
  }
  return selects;
}

function parsePdpBrand(html) {
  const match = html.match(/<p class="pdp-brand">([^<]+)<\/p>/i);
  return match ? decodeEntities(match[1]).trim() : "";
}

function parsePdpCategory(html) {
  const match = html.match(/<div><dt>Category<\/dt><dd>([^<]+)<\/dd><\/div>/i);
  return match ? decodeEntities(match[1]).trim() : "";
}

function listBrandSupplementProductIds(brands) {
  const excluded = new Set([
    "Training apparel",
    "Training footwear",
    "Gym accessory",
    "Training gear",
    "Recovery device",
  ]);

  return catalogData.products
    .map((product) => String(product.id))
    .filter((productId) => hasProductHtml(productId))
    .filter((productId) => {
      const html = readProductHtml(productId);
      const brand = parsePdpBrand(html);
      const category = parsePdpCategory(html);
      return brands.includes(brand) && !excluded.has(category);
    });
}

function variantValueGroup(value) {
  const words = String(value == null ? "" : value).toLowerCase().match(/[a-z0-9]+/g) || [];
  return {
    compact: words.join(""),
    words: words.filter((word) => word.length >= 3),
    stems: words.filter((word) => word.length >= 5).map((word) => word.slice(0, 5)),
  };
}

function pickVariantImage(galleryImages, values) {
  if (!galleryImages.length) return null;
  const groups = values.map(variantValueGroup).filter((group) => group.compact);
  if (!groups.length) return null;

  let best = null;
  let bestScore = 0;
  for (const image of galleryImages) {
    const blob = image.t || "";
    if (!blob) continue;
    let score = 0;
    for (const group of groups) {
      if (group.compact && blob.includes(group.compact)) {
        score += 2;
        continue;
      }
      if (group.words.some((word) => blob.includes(word))) {
        score += 1;
      } else if (group.stems.some((stem) => blob.includes(stem))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = image.src;
    }
  }
  return bestScore > 0 ? best : null;
}

function pickRepresentativeProducts(products) {
  const selected = [];
  const seen = new Set();

  function addMatch(predicate) {
    const match = products.find((product) => {
      const id = String(product.id);
      return !seen.has(id) && predicate(product) && hasProductHtml(id);
    });
    if (!match) return;
    selected.push(match);
    seen.add(String(match.id));
  }

  addMatch(
    (product) =>
      Number(product.price_cents) > 0 &&
      product.available === true &&
      product.requires_variant_selection === true
  );
  addMatch(
    (product) =>
      Number(product.price_cents) > 0 &&
      product.available === true &&
      product.compare_at_price_cents != null
  );
  addMatch((product) => Number(product.price_cents) > 0 && product.available === true);

  for (const product of products) {
    const id = String(product.id);
    if (selected.length >= SAMPLE_SIZE) break;
    if (seen.has(id) || !hasProductHtml(id)) continue;
    if (!(Number(product.price_cents) > 0) || product.available !== true) continue;
    selected.push(product);
    seen.add(id);
  }

  return selected;
}

const sampledProducts = pickRepresentativeProducts(catalogData.products);
const searchIndexProducts = Array.isArray(searchIndexData.products) ? searchIndexData.products : [];

assert.ok(
  sampledProducts.length > 0,
  "expected at least one available catalog product with a generated PDP html file"
);

test("search index keeps variant purchase metadata for variant-aware products", () => {
  const variantAwareProducts = searchIndexProducts.filter((product) => product.has_variants === true);
  assert.ok(variantAwareProducts.length > 0, "expected variant-aware products in the search index");

  for (const product of variantAwareProducts) {
    assert.ok(
      String(product.default_variant_id || "").trim(),
      `search index product ${product.id} should include default_variant_id when has_variants is true`
    );
    assert.ok(
      Number(product.variant_count) > 0,
      `search index product ${product.id} should include a positive variant_count when has_variants is true`
    );
  }

  const requiresSelectionProducts = searchIndexProducts.filter(
    (product) => product.requires_variant_selection === true
  );
  assert.ok(
    requiresSelectionProducts.length > 0,
    "expected products that require variant selection in the search index"
  );

  for (const product of requiresSelectionProducts) {
    assert.ok(
      String(product.default_variant_id || "").trim(),
      `search index product ${product.id} should include default_variant_id when variant selection is required`
    );
    assert.ok(
      Number(product.variant_count) > 0,
      `search index product ${product.id} should include variant_count when variant selection is required`
    );
  }
});

for (const product of sampledProducts) {
  test(`PDP ${product.id} stays consistent with catalog storefront data`, () => {
    const html = readProductHtml(product.id);
    const expectedPrice = formatUsdFromCents(product.price_cents);

    const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    assert.ok(h1Match, `product ${product.id} should render an h1`);
    assert.equal(
      normalizeText(h1Match[1]),
      product.name,
      `product ${product.id} h1 should match catalog name`
    );

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    assert.ok(titleMatch, `product ${product.id} should render a title`);
    assert.ok(
      normalizeText(titleMatch[1]).includes(product.name),
      `product ${product.id} title should include catalog name`
    );

    const priceRowMatch = html.match(
      /<div\b[^>]*data-pdp-price-row\b[^>]*data-base-price-cents="([^"]*)"[^>]*>[\s\S]*?<strong\b[^>]*data-pdp-price\b[^>]*>([^<]+)<\/strong>/i
    );
    assert.ok(priceRowMatch, `product ${product.id} should render a PDP price block`);
    assert.equal(
      Number(priceRowMatch[1]),
      Number(product.price_cents),
      `product ${product.id} price row should carry catalog price_cents`
    );
    assert.equal(
      normalizeText(priceRowMatch[2]),
      expectedPrice,
      `product ${product.id} displayed PDP price should match catalog price_cents`
    );

    assert.doesNotMatch(
      html,
      BANNED_COPY_RE,
      `product ${product.id} should not contain Amazon-facing copy`
    );
  });
}

test("PDP 183 resolves the Boogieman Punch gallery image from partial flavor tokens", () => {
  const html = readProductHtml("183");
  const pageVariants = parseJsonAssignment(html, "variantPricing");
  const galleryImages = parseJsonAssignment(html, "galleryImages");
  const boogiemanVariant = pageVariants.find(
    (variant) => String(variant.variant_id) === "41418769236064"
  );

  assert.ok(boogiemanVariant, "expected Boogieman Punch variant on PDP 183");
  assert.equal(
    boogiemanVariant.image_url,
    "https://cdn.shopify.com/s/files/1/1214/7132/files/muscletech-creatine-boogie-citrus-front.jpg"
  );
  assert.equal(
    pickVariantImage(galleryImages, ["Boogieman Punch"]),
    boogiemanVariant.image_url,
    "Boogieman Punch should resolve the matching front image even when the filename uses 'boogie'"
  );
});

test("PDP 174 keeps the vanilla 4 lb variant mapped to the vanilla image", () => {
  const html = readProductHtml("174");
  const pageVariants = parseJsonAssignment(html, "variantPricing");
  const vanillaVariant = pageVariants.find(
    (variant) => variant.key === "4 lb. / French Vanilla Bean"
  );

  assert.ok(vanillaVariant, "expected French Vanilla Bean 4 lb. variant on PDP 174");
  assert.equal(
    vanillaVariant.image_url,
    "https://cdn.shopify.com/s/files/1/1214/7132/files/NitroTech-Ripped-4lb-van.jpg"
  );
});

test("PDP 196 keeps the Citrus Punch variant mapped to the citrus image", () => {
  const html = readProductHtml("196");
  const pageVariants = parseJsonAssignment(html, "variantPricing");
  const citrusVariant = pageVariants.find(
    (variant) => variant.key === "Citrus Punch / 3 lb."
  );

  assert.ok(citrusVariant, "expected Citrus Punch / 3 lb. variant on PDP 196");
  assert.equal(
    citrusVariant.image_url,
    "https://cdn.shopify.com/s/files/1/1214/7132/files/celltech-citrus-3lb_aa616c64-0d61-4104-a07a-e8b6cc84ad27.jpg"
  );
});

test("PDP 199 keeps its single flavor selector aligned with flavor-only variants", () => {
  const html = readProductHtml("199");
  const pageVariants = parseJsonAssignment(html, "variantPricing");
  const variantSelects = parseVariantSelects(html);

  assert.equal(variantSelects.length, 1, "expected a single selector on PDP 199");
  assert.equal(variantSelects[0].name, "Flavor");

  for (const variant of pageVariants) {
    assert.equal(variant.optionValues.length, 1, "expected flavor-only optionValues");
    assert.deepEqual(Object.keys(variant.selected_options || {}), ["Flavor"]);
  }
});

test("MuscleTech bundle PDPs keep their single variant labeled and imaged", () => {
  const cases = [
    [
      "184",
      "Creatine Bundle",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/bundle-creatine-bundle-family.jpg",
    ],
    [
      "185",
      "The OG",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/bundle-og.jpg",
    ],
    [
      "191",
      "Boogieman Bundle",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/bundle-boogieman.jpg",
    ],
    [
      "192",
      "Gains Bundle",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/bundle-gains-bundle.jpg",
    ],
  ];

  for (const [productId, expectedTitle, expectedImage] of cases) {
    const html = readProductHtml(productId);
    const pageVariants = parseJsonAssignment(html, "variantPricing");

    assert.equal(pageVariants.length, 1, `expected one variant on PDP ${productId}`);
    assert.equal(pageVariants[0].title, expectedTitle);
    assert.equal(pageVariants[0].key, expectedTitle);
    assert.equal(pageVariants[0].image_url, expectedImage);
    assert.ok(!html.includes('data-pdp-variant data-variant-name='), `expected no selectors on PDP ${productId}`);
  }
});

test("PDP 200 resolves Nitro Tech Whey Gold flavor-size image mappings", () => {
  const html = readProductHtml("200");
  const pageVariants = parseJsonAssignment(html, "variantPricing");
  const galleryImages = parseJsonAssignment(html, "galleryImages");
  const gallerySources = new Set(galleryImages.map((image) => image.src));

  const cases = [
    [
      "French Vanilla Cream / 2 lb.",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/mt-nitro-tech-100-whey-gold-french-vanilla-2lb_5eb1c01a-5fe3-44fd-8754-a06f77818fae.png",
    ],
    [
      "Double Rich Chocolate / 2 lb.",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/mt-nitro-tech-100-whey-gold-chocolate-2lb.png",
    ],
    [
      "Chocolate Peanut Butter / 2 lb.",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/muscletech-nitrotech-whey-gold-pb-2lb_296a931b-f6dc-42b3-99ac-ed8aefb0400d.png",
    ],
    [
      "Chocolate Peanut Butter / 5 lb.",
      "https://cdn.shopify.com/s/files/1/1214/7132/files/muscletech-nitrotech-whey-gold-pb-5lb_7fd4821c-139e-45a4-9619-0310705724a4.png",
    ],
  ];

  for (const [key, expectedImage] of cases) {
    const variant = pageVariants.find((entry) => entry.key === key);
    assert.ok(variant, `expected ${key} variant on PDP 200`);
    assert.equal(variant.image_url, expectedImage);
    assert.ok(gallerySources.has(expectedImage), `${key} should ship its image in the gallery`);
  }
});

test("MuscleTech creatine PDPs keep unavailable flavors blocked in variantPricing", () => {
  const cases = [
    ["187", "Fruit Punch Extreme"],
    ["195", "Grape Freeze"],
    ["195", "Red Berry"],
  ];

  for (const [productId, variantKey] of cases) {
    const html = readProductHtml(productId);
    const pageVariants = parseJsonAssignment(html, "variantPricing");
    const variant = pageVariants.find((entry) => entry.key === variantKey);

    assert.ok(variant, `expected ${variantKey} on PDP ${productId}`);
    assert.equal(variant.available, false, `${variantKey} should stay blocked on PDP ${productId}`);
  }
});

test("Animal, Redcon1, Transparent Labs, and Bare Performance PDPs keep variant metadata storefront-safe", () => {
  const productIds = listBrandSupplementProductIds([
    "Animal",
    "Redcon1",
    "Transparent Labs",
    "Bare Performance",
  ]);

  assert.ok(productIds.length > 0, "expected supplement PDPs for audited brands");

  for (const productId of productIds) {
    const html = readProductHtml(productId);
    const pageVariants = parseJsonAssignment(html, "variantPricing");
    const selectors = parseVariantSelects(html);
    const mainImageMatch = html.match(/<img id="pdp-main-image" src="([^"]+)"/i);
    const mainImage = mainImageMatch ? decodeEntities(mainImageMatch[1]) : "";

    assert.ok(pageVariants.length > 0, `expected variantPricing on PDP ${productId}`);

    for (const variant of pageVariants) {
      assert.notEqual(
        String(variant.title || "").trim(),
        "",
        `variant title should be present on PDP ${productId}`
      );
      assert.ok(
        !/^\d+$/.test(String(variant.title || "")),
        `variant title should not be a raw numeric id on PDP ${productId}`
      );
      assert.ok(
        String(variant.image_url || "").trim(),
        `variant image_url should be present on PDP ${productId}`
      );
    }

    if (
      pageVariants.length === 1 &&
      selectors.length === 0 &&
      Object.keys(pageVariants[0].selected_options || {}).length === 0
    ) {
      assert.equal(
        pageVariants[0].title,
        normalizeText((html.match(/<h1 class="pdp-title"[^>]*>([^<]+)<\/h1>/i) || [])[1] || ""),
        `single-variant PDP ${productId} should use the product title as the variant title`
      );
    }

    if (pageVariants[0] && mainImage) {
      assert.equal(
        pageVariants[0].image_url,
        mainImage,
        `default PDP hero image should match the first variant on PDP ${productId}`
      );
    }
  }
});

for (const productId of VARIANT_REGRESSION_PRODUCT_IDS) {
  test(`PDP ${productId} keeps variant titles, options, and images aligned with the catalog`, () => {
    const product = catalogData.products.find((entry) => String(entry.id) === productId);
    const searchRecord = searchIndexProducts.find((entry) => String(entry.id) === productId);
    assert.ok(product, `expected catalog product ${productId}`);
    assert.ok(searchRecord, `expected search index product ${productId}`);
    assert.equal(
      product.requires_variant_selection,
      true,
      `product ${productId} should require variant selection for this regression audit`
    );

    const html = readProductHtml(productId);
    const pageVariants = parseJsonAssignment(html, "variantPricing");
    const galleryImages = parseJsonAssignment(html, "galleryImages");
    const variantSelects = parseVariantSelects(html);
    const addButtonDataset = parseAddButtonDataset(html);
    const catalogVariants = Array.isArray(product.variants) ? product.variants : [];
    const sampledVariantIds = new Set((VARIANT_IMAGE_CASES[productId] || []).map(String));

    assert.ok(catalogVariants.length > 0, `product ${productId} should have catalog variants`);
    assert.equal(
      pageVariants.length,
      catalogVariants.length,
      `product ${productId} should embed every catalog variant`
    );

    const catalogVariantsById = new Map(
      catalogVariants.map((variant) => [String(variant.variant_id), variant])
    );
    const gallerySources = new Set(galleryImages.map((image) => image.src));

    for (const pageVariant of pageVariants) {
      const variantId = String(pageVariant.variant_id);
      const catalogVariant = catalogVariantsById.get(variantId);
      assert.ok(catalogVariant, `product ${productId} should include catalog variant ${variantId}`);

      assert.equal(
        pageVariant.title,
        catalogVariant.title,
        `product ${productId} variant ${variantId} title should match catalog`
      );
      assert.deepEqual(
        pageVariant.selected_options,
        catalogVariant.selected_options,
        `product ${productId} variant ${variantId} selected options should match catalog`
      );
      assert.equal(
        Number(pageVariant.price_cents),
        Number(catalogVariant.price_cents),
        `product ${productId} variant ${variantId} price should match catalog`
      );
      if (sampledVariantIds.has(variantId)) {
        assert.equal(
          pageVariant.image_url ?? null,
          catalogVariant.image_url ?? null,
          `product ${productId} variant ${variantId} image should match catalog`
        );
        assert.ok(
          gallerySources.has(catalogVariant.image_url),
          `product ${productId} variant ${variantId} image should be present in the PDP gallery`
        );
      }
    }

    for (const select of variantSelects) {
      const expectedValues = new Set(
        catalogVariants
          .map((variant) => variant.selected_options?.[select.name])
          .filter(Boolean)
      );
      assert.deepEqual(
        new Set(select.values),
        expectedValues,
        `product ${productId} select ${select.name} should expose the catalog option values`
      );
    }

    const defaultVariantId = String(product.default_variant_id || "");
    const defaultVariant = catalogVariantsById.get(defaultVariantId);
    assert.ok(defaultVariant, `product ${productId} should have a catalog default variant`);
    assert.equal(
      searchRecord.has_variants,
      true,
      `product ${productId} search index record should stay marked as variant-aware`
    );
    assert.equal(
      searchRecord.requires_variant_selection,
      true,
      `product ${productId} search index record should require variant selection`
    );
    assert.equal(
      String(searchRecord.default_variant_id || ""),
      defaultVariantId,
      `product ${productId} search index default variant should match the catalog`
    );
    assert.equal(
      Number(searchRecord.variant_count),
      catalogVariants.length,
      `product ${productId} search index variant_count should match the catalog`
    );
    assert.equal(
      addButtonDataset["data-cart-variant-id"],
      defaultVariantId,
      `product ${productId} add-to-cart button should point at the catalog default variant`
    );
    assert.deepEqual(
      JSON.parse(addButtonDataset["data-cart-selected-options"] || "{}"),
      defaultVariant.selected_options,
      `product ${productId} add-to-cart default selected options should match catalog`
    );
    for (const variantId of sampledVariantIds) {
      const catalogVariant = catalogVariantsById.get(String(variantId));
      assert.ok(catalogVariant, `product ${productId} should include sampled variant ${variantId}`);
      assert.ok(
        catalogVariant.image_url,
        `product ${productId} sampled variant ${variantId} should have an image`
      );
      const selectedValues = variantSelects
        .map((select) => catalogVariant.selected_options?.[select.name])
        .filter(Boolean);
      assert.ok(
        selectedValues.length > 0,
        `product ${productId} sampled variant ${variantId} should map to visible selects`
      );
      assert.equal(
        pickVariantImage(galleryImages, selectedValues),
        catalogVariant.image_url,
        `product ${productId} image picker should resolve variant ${variantId} correctly`
      );
      assert.equal(
        `${product.name} - ${catalogVariant.title}`,
        `${product.name} - ${pageVariants.find((variant) => String(variant.variant_id) === String(variantId)).title}`,
        `product ${productId} sampled variant ${variantId} should preserve its composed title`
      );
    }

    const h1Match = html.match(/<h1\b[^>]*data-pdp-title\b[^>]*>([\s\S]*?)<\/h1>/i);
    assert.ok(h1Match, `product ${productId} should render a PDP title element`);
    assert.equal(
      normalizeText(h1Match[1]),
      product.name,
      `product ${productId} should keep the base title anchored to the catalog product name`
    );
  });
}
