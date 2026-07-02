const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SUPPLEMENT_WHOLESALE_BRANDS,
  WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS,
  deriveSupplementCategory,
  loadSupplementsCatalogManifest,
  normalizeSupplementsCatalogProduct,
  supplementWholesalePriceCents,
} = require("../api/_lib/wholesale-supplements");
const { sanitizeQuoteItem } = require("../api/_lib/wholesale-muay-thai");

test("supplements wholesale discount is 50%", () => {
  assert.equal(WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS, 5000);
  assert.equal(supplementWholesalePriceCents(10000), 5000);
  assert.equal(supplementWholesalePriceCents(2999), 1500);
  assert.equal(supplementWholesalePriceCents(1), 1);
  assert.equal(supplementWholesalePriceCents(null), null);
  assert.equal(supplementWholesalePriceCents(0), null);
});

test("normalizeSupplementsCatalogProduct applies supplement pricing", () => {
  const product = normalizeSupplementsCatalogProduct({
    id: "sup-1",
    brand_slug: "optimum_nutrition",
    brand: "Optimum Nutrition",
    name: "Gold Standard Whey",
    retail_price_cents: 7999,
    available: true,
    sizes: ["2 lb", "5 lb"],
    colors: ["Chocolate", "Vanilla"],
  });

  assert.equal(product.retail_price_cents, 7999);
  assert.equal(product.wholesale_price_cents, 4000);
  assert.equal(product.wholesale_discount_bps, 5000);
  assert.equal(product.category_label, "Supplements");
});

test("sanitizeQuoteItem keeps supplement discount from catalog product", () => {
  const product = normalizeSupplementsCatalogProduct({
    id: "sup-2",
    brand_slug: "muscletech",
    name: "Nitro-Tech",
    retail_price_cents: 5999,
    available: true,
    sizes: [],
    colors: [],
  });

  const item = sanitizeQuoteItem({ quantity: 3, selected_options: { Flavor: "Chocolate" } }, product);
  assert.equal(item.retail_price_cents, 5999);
  assert.equal(item.wholesale_price_cents, 3000);
  assert.equal(item.wholesale_discount_bps, 5000);
  assert.equal(item.quantity, 3);
  assert.deepEqual(item.selected_options, { Flavor: "Chocolate" });
});

test("deriveSupplementCategory maps store collections", () => {
  assert.deepEqual(deriveSupplementCategory("pre_workout"), { slug: "pre_workout", label: "Pre-Workout" });
  assert.deepEqual(deriveSupplementCategory("collagen_beauty"), { slug: "collagen_beauty", label: "Collagen & Beauty" });
  assert.deepEqual(deriveSupplementCategory("unknown_thing"), { slug: "unknown_thing", label: "Supplements" });
  assert.deepEqual(deriveSupplementCategory(""), { slug: "supplements", label: "Supplements" });
});

test("supplements catalog manifest loads with priced products from approved brands", () => {
  const manifest = loadSupplementsCatalogManifest();
  assert.ok(manifest.products.length > 1000, "expected a large supplements catalog");

  const priced = manifest.products.filter((product) => Number.isInteger(product.retail_price_cents));
  assert.ok(priced.length / manifest.products.length > 0.9, "expected >90% of products priced");

  for (const product of manifest.products.slice(0, 500)) {
    assert.ok(SUPPLEMENT_WHOLESALE_BRANDS.has(product.brand_slug), `unexpected brand ${product.brand_slug}`);
    assert.equal(product.wholesale_discount_bps, 5000);
    if (Number.isInteger(product.retail_price_cents)) {
      assert.equal(
        product.wholesale_price_cents,
        Math.max(1, Math.round(product.retail_price_cents * 0.5))
      );
    } else {
      assert.equal(product.wholesale_price_cents, null);
    }
  }

  const brands = new Set(manifest.products.map((product) => product.brand_slug));
  for (const required of ["optimum_nutrition", "muscletech", "animal_pak"]) {
    assert.ok(brands.has(required), `missing required brand ${required}`);
  }
});
