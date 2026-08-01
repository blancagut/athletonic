const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SUPPLEMENT_WHOLESALE_BRANDS,
  TRAINER_SUPPLEMENTS_DISCOUNT_BPS,
  WHOLESALE_SUPPLEMENTS_DISCOUNT_BPS,
  deriveSupplementCategory,
  isHealthCareSupplement,
  loadSupplementsCatalogManifest,
  normalizeSupplementsCatalogProduct,
  supplementTrainerPriceCents,
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

test("supplements trainer discount is 30%", () => {
  assert.equal(TRAINER_SUPPLEMENTS_DISCOUNT_BPS, 3000);
  assert.equal(supplementTrainerPriceCents(10000), 7000);
  assert.equal(supplementTrainerPriceCents(2999), 2099);
  assert.equal(supplementTrainerPriceCents(1), 1);
  assert.equal(supplementTrainerPriceCents(null), null);
  assert.equal(supplementTrainerPriceCents(0), null);
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
  assert.equal(product.trainer_price_cents, 5599);
  assert.equal(product.trainer_discount_bps, 3000);
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

test("health care categories stay separate from performance supplements", () => {
  assert.equal(isHealthCareSupplement({ brand_slug: "agent_nateur" }), true);
  assert.equal(isHealthCareSupplement({ brand_slug: "o_positiv" }), true);
  assert.equal(isHealthCareSupplement({ brand_slug: "optimum_nutrition" }), false);
  assert.equal(isHealthCareSupplement({ brand_slug: "ghost_lifestyle" }), false);
});

test("supplements catalog manifest loads with priced products from approved brands", () => {
  const manifest = loadSupplementsCatalogManifest();
  assert.ok(manifest.products.length > 1000, "expected a large supplements catalog");

  const priced = manifest.products.filter((product) => Number.isInteger(product.retail_price_cents));
  assert.ok(priced.length / manifest.products.length > 0.9, "expected >90% of products priced");

  for (const product of manifest.products.slice(0, 500)) {
    assert.equal(product.wholesale_discount_bps, 5000);
    assert.equal(product.trainer_discount_bps, 3000);
    if (Number.isInteger(product.retail_price_cents)) {
      assert.equal(
        product.wholesale_price_cents,
        Math.max(1, Math.round(product.retail_price_cents * 0.5))
      );
      assert.equal(
        product.trainer_price_cents,
        Math.max(1, Math.round((product.retail_price_cents * 7000) / 10000))
      );
    } else {
      assert.equal(product.wholesale_price_cents, null);
      assert.equal(product.trainer_price_cents, null);
    }
  }

  const brands = new Set(manifest.products.map((product) => product.brand_slug));
  for (const required of ["optimum_nutrition", "muscletech", "animal_pak"]) {
    assert.ok(brands.has(required), `missing required brand ${required}`);
  }
});

test("performance brand list contains only the requested brands", () => {
  assert.equal(SUPPLEMENT_WHOLESALE_BRANDS.size, 28);
  for (const required of ["nutrabio", "myprotein", "bare_performance", "promix"]) {
    assert.ok(SUPPLEMENT_WHOLESALE_BRANDS.has(required), `missing requested brand ${required}`);
  }
});

test("Optimum wholesale rows are split by size and use MSRP instead of sale price", () => {
  const manifest = loadSupplementsCatalogManifest();
  const optimum = manifest.products.filter((product) => product.brand_slug === "optimum_nutrition");
  const whey5lb = optimum.find((product) => product.id === "official-optimum-gold-standard-100-whey-protein-powder-5-lb");
  const serious6lb = optimum.find((product) => product.id === "official-optimum-serious-mass-weight-gainer-protein-powder-6-lb");
  const serious12lb = optimum.find((product) => product.id === "official-optimum-serious-mass-weight-gainer-protein-powder-12-lb");

  assert.ok(whey5lb);
  assert.deepEqual(whey5lb.sizes, ["5 lb"]);
  assert.equal(whey5lb.retail_price_cents, 13199);
  assert.equal(whey5lb.wholesale_price_cents, 6600);
  assert.ok(whey5lb.colors.includes("Double Rich Chocolate"));
  assert.ok(whey5lb.colors.includes("Vanilla Ice Cream"));
  assert.ok(serious6lb);
  assert.ok(serious12lb);
  assert.deepEqual(serious6lb.sizes, ["6 lb"]);
  assert.deepEqual(serious12lb.sizes, ["12 lb"]);
  assert.equal(serious12lb.retail_price_cents, 11499);
});
