"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const catalog = require("../data/final/catalog.published.json");
const { normalizeProductId, validateCart } = require("../api/_lib/catalog");
const { applyPrivatePricing } = require("../api/_lib/private-pricing");
const checkout = require("../api/checkout/index");
const email = require("../api/_lib/email");

const variantProducts = catalog.products.filter((p) => Array.isArray(p.variants) && p.variants.length);
const productA = variantProducts[0];
const productB = variantProducts.find((p) => String(p.id) !== String(productA.id));

test("retail endpoints explicitly disable manual order fallback", () => {
  for (const file of ["api/cart/validate.js", "api/checkout/index.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.match(source, /allowManualOrder:\s*false/);
  }
});

test("stale and cross-product variants are rejected and required variants need IDs", () => {
  assert.throws(
    () => validateCart([{ productId: productA.id, variant_id: "removed-variant", quantity: 1 }]),
    (error) => error.code === "variant_unavailable"
  );
  assert.throws(
    () => validateCart([{ productId: productA.id, variant_id: productB.variants[0].variant_id, quantity: 1 }]),
    (error) => error.code === "invalid_variant"
  );
  assert.throws(
    () => validateCart([{ productId: productA.id, quantity: 1 }]),
    (error) => error.code === "variant_required"
  );
});

test("private discounts apply once only to explicit supplement and combat sections", () => {
  const result = applyPrivatePricing([
    { product_id: "supp", section_id: "protein", quantity: 1, unit_amount_cents: 10000 },
    { product_id: "combat", section_id: "combat-sports", quantity: 1, unit_amount_cents: 10000 },
    { product_id: "shoe", section_id: "shoes", quantity: 1, unit_amount_cents: 10000 },
  ], { id: "grant", source: "account" });
  assert.deepEqual(result.lineDiscounts.map((line) => line.discount_bps), [5000, 4000, 0]);
  assert.equal(result.discountCents, 9000);
});

test("legacy aliases resolve canonically without bypassing stale variants", () => {
  const canonical = catalog.products.find((product) => String(product.id) === "1509");
  const staleVariant = canonical.variants[0];
  assert.equal(normalizeProductId("1509-other"), "1509");
  assert.throws(
    () => validateCart([{
      productId: "1509-other",
      variant_id: staleVariant.variant_id,
      selected_options: staleVariant.selected_options,
      quantity: 1,
    }]),
    (error) => ["product_unavailable", "variant_unavailable"].includes(error.code)
  );
  assert.throws(
    () => validateCart([{ productId: "official-boon-none", quantity: 1 }]),
    (error) => error.code === "product_unavailable"
  );
});

test("checkout intent and order snapshots preserve validated identity and historical price", () => {
  const pricing = {
    currency: "USD",
    lineDiscounts: [{ product_id: "p1", discount_bps: 4000, discount_cents: 800 }],
    items: [{
      product_id: "p1", variant_id: "v1", sku: "SKU-1", brand: "Brand", name: "Name",
      variant: "Color: Red", image_url: "/image.jpg", quantity: 2, unit_amount_cents: 2000,
      public_unit_amount_cents: 2500, regular_unit_amount_cents: 3000,
      product_snapshot: { url: "/product/p1.html", image_url: "/image.jpg", selected_options: { Color: "Red" } },
    }],
  };
  const intent = checkout.buildCheckoutCart(pricing)[0];
  assert.equal(intent.product_id, "p1");
  assert.equal(intent.variant_id, "v1");
  assert.deepEqual(intent.selected_options, { Color: "Red" });
  const snapshot = checkout.buildOrderItems(pricing)[0];
  pricing.items[0].unit_amount_cents = 9999;
  assert.equal(snapshot.unit_amount_cents, 2000);
  assert.equal(snapshot.line_subtotal_cents, 4000);
});

test("bank-transfer email labels use stored amount fields", () => {
  const order = { currency: "USD", amounts: { subtotal_cents: 10000, discount_cents: 1000, shipping_cents: 500, tax_cents: 100, total_cents: 9600 } };
  assert.deepEqual(email.bankTransferAmountsText(order), [
    "Subtotal: $100.00", "Discount: -$10.00", "Shipping: $5.00", "Tax: $1.00", "Final total: $96.00",
  ]);
});

test("cart storage is versioned and bank-transfer confirmation verifies server data", () => {
  const cartSource = fs.readFileSync(path.join(__dirname, "../assets/cart.js"), "utf8");
  assert.match(cartSource, /JSON\.stringify\(\{ version: 2, items: items \}\)/);
  assert.doesNotMatch(cartSource.slice(cartSource.indexOf("function saveCart"), cartSource.indexOf("function formatMoney")), /price:/);
  const confirmation = fs.readFileSync(path.join(__dirname, "../assets/order-confirmation.js"), "utf8");
  assert.match(confirmation, /fetch\("\/api\/orders\/lookup"/);
  assert.doesNotMatch(confirmation, /renderOrder\(stored\)/);
});

test("only one canonical primaryProductHref remains and internal URLs are canonical", () => {
  const source = fs.readFileSync(path.join(__dirname, "../assets/cart.js"), "utf8");
  assert.equal((source.match(/function primaryProductHref\(/g) || []).length, 1);
  assert.match(source, /external_only === true && product\.has_pdp === false/);

  const home = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const twinsStart = home.indexOf("<h2>Twins Special</h2>", home.indexOf('id="home-shelf'));
  const twinsEnd = home.indexOf("</section>", twinsStart);
  const twinsShelf = home.slice(twinsStart, twinsEnd);
  const topKingStart = home.indexOf("<h2>Top King</h2>", twinsEnd);
  const boonStart = home.indexOf("<h2>Boon</h2>", topKingStart);
  const nutritionStart = home.indexOf("<h2>Optimum Nutrition &amp; MuscleTech</h2>", boonStart);
  assert.equal((twinsShelf.match(/>twins_special</g) || []).length, 18);
  assert.ok(twinsStart < topKingStart);
  assert.ok(topKingStart < boonStart);
  assert.ok(boonStart < nutritionStart);
  assert.match(home, /pages\/supplements\.html/);
  assert.match(home, /class="department-submenu"/);
  assert.match(home, /Nike &amp; Footwear/);
  assert.doesNotMatch(home, /Protein Deals &amp; 5LB Tubs|Creatine Best Sellers|Hydration &amp; Electrolytes|Bundles &amp; Multi-pack Deals/);
  for (const slug of ["twins-special", "boxing-gloves", "top-king", "boon", "muay-thai-shorts", "shin-guards", "pads-punch-mitts", "heavy-bags", "gym-equipment", "fight-clothing", "supplements"]) {
    assert.match(home, new RegExp(`pages/${slug}\\.html`));
    const categoryPage = fs.readFileSync(path.join(__dirname, `../pages/${slug}.html`), "utf8");
    assert.match(categoryPage, /class="product-card"/);
    assert.match(categoryPage, /data-listing-filter/);
  }
  for (const slug of ["boxing-gloves", "top-king-boon", "muay-thai-shorts", "shin-guards", "pads-punch-mitts", "heavy-bags", "gym-equipment", "fight-clothing", "brands"]) {
    const categoryPage = fs.readFileSync(path.join(__dirname, `../pages/${slug}.html`), "utf8");
    const shelfCount = (categoryPage.match(/class="market-section listing-section"/g) || []).length;
    const quickLinkCount = (categoryPage.match(/class="listing-quick-links"/g) || []).length;
    assert.ok(shelfCount >= 2, `${slug} should be organized into at least two product sections`);
    assert.equal(quickLinkCount, 1, `${slug} should have one collection navigation toolbar`);
    assert.match(categoryPage, /href="#[^"]+"/, `${slug} should include in-page category buttons`);
  }
  assert.match(fs.readFileSync(path.join(__dirname, "../pages/brands.html"), "utf8"), /directory-group-collapsible/);
  for (const file of ["data/checkout-catalog.json", "data/search-index.json", "data/final/catalog.published.json", "data/final/search-index.published.json"]) {
    const catalogSource = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.doesNotMatch(catalogSource, /hanging mirror boxing gloves|rear view mirror heavy bag/i);
  }
  assert.match(home, /checkout-international-notice/);
  assert.match(home, /This is not a pricing error/);
});
