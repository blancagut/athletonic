"use strict";

// Runtime guard for the checkout money path. `npm test` previously only ran
// `node --check` (syntax), which did NOT catch the regression where every cart
// was rejected because the V1 catalog has no `purchasable`/`ready_for_sale`
// fields. These assertions exercise the real `validateCart` against the real
// catalog plus two synthetic products. No network, no Stripe, no Supabase.

const test = require("node:test");
const assert = require("node:assert/strict");

// Inject synthetic products BEFORE catalog.js loads so they are included when it
// builds its in-memory index. catalog.js requires the SAME cached JSON object
// (same resolved path), so this mutation is visible to it. Done at module top
// level, which runs before any test registers. Must mirror catalog.js: it loads
// the authoritative checkout catalog first, curated catalog as fallback.
let catalogData;
try {
  catalogData = require("../data/checkout-catalog.json");
} catch (error) {
  catalogData = require("../data/athletonic-catalog.json");
}

const SYN_UNPURCHASABLE = "__test_unpurchasable__";
const SYN_UNAVAILABLE = "__test_unavailable__";
const SYN_FLAGGED_UNAVAILABLE_WITH_PRICE = "__test_flagged_unavailable_with_price__";
const SYN_VARIANT = "__test_variant_required__";
const SYN_MANUAL_VARIANT = "__test_manual_order_variant__";

catalogData.products.push({
  id: SYN_UNPURCHASABLE,
  brand: "Test",
  name: "Synthetic Unpurchasable",
  price_cents: 1234,
  currency: "USD",
  available: true,
  purchasable: false,
});
catalogData.products.push({
  id: SYN_UNAVAILABLE,
  brand: "Test",
  name: "Synthetic No Price",
  price_cents: 0,
  currency: "USD",
  available: false,
});
catalogData.products.push({
  id: SYN_FLAGGED_UNAVAILABLE_WITH_PRICE,
  brand: "Test",
  name: "Synthetic Flagged Unavailable With Price",
  price_cents: 1234,
  currency: "USD",
  available: false,
});
// Mirrors the live catalog shape: a product that requires the shopper to pick
// an option but ships NO structured variant rows (so `has_variants` is false).
catalogData.products.push({
  id: SYN_VARIANT,
  brand: "Test",
  name: "Synthetic Variant Required",
  price_cents: 4999,
  currency: "USD",
  available: true,
  requires_variant_selection: true,
});
catalogData.products.push({
  id: SYN_MANUAL_VARIANT,
  brand: "Test",
  name: "Synthetic Manual Variant Order",
  price_cents: 2500,
  currency: "USD",
  available: true,
  has_variants: true,
  requires_variant_selection: true,
  variants: [
    {
      variant_id: "known-variant",
      title: "Known Variant",
      price_cents: 2500,
      currency: "USD",
      available: true,
    },
  ],
});

const { evaluateCart, validateCart } = require("../api/_lib/catalog.js");

const realProduct = catalogData.products.find(
  (p) =>
    p.id !== SYN_UNPURCHASABLE &&
    p.id !== SYN_UNAVAILABLE &&
    Number(p.price_cents) > 0 &&
    p.available === true &&
    (p.has_variants !== true || p.default_variant_id)
);

assert.ok(realProduct, "expected at least one sellable product in the catalog");
const realProductVariant =
  Array.isArray(realProduct.variants) && realProduct.default_variant_id
    ? realProduct.variants.find(
        (variant) => String(variant.variant_id) === String(realProduct.default_variant_id)
      ) || null
    : null;
const realProductUnitPriceCents = Number(
  realProductVariant?.price_cents || realProduct.price_cents || 0
);

function realProductCartLine(overrides = {}) {
  return {
    productId: String(realProduct.id),
    quantity: 1,
    ...(realProductVariant
      ? {
          variant_id: String(realProductVariant.variant_id),
          variantId: String(realProductVariant.variant_id),
        }
      : {}),
    ...overrides,
  };
}

function expectReject(cart, expectedCode) {
  assert.throws(
    () => validateCart(cart),
    (err) => {
      assert.equal(
        err.code,
        expectedCode,
        `expected rejection code "${expectedCode}", got "${err.code}"`
      );
      return true;
    }
  );
}

test("a real catalog product validates and returns the server unit price", () => {
  const result = validateCart([realProductCartLine({ quantity: 2 })]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unit_amount_cents, realProductUnitPriceCents);
  assert.equal(result.subtotalCents, realProductUnitPriceCents * 2);
});

test("a client-supplied price is ignored in favor of the server price", () => {
  const result = validateCart([
    realProductCartLine({
      price: 1,
      price_cents: 1,
      unit_amount_cents: 1,
    }),
  ]);
  assert.equal(result.items[0].unit_amount_cents, realProductUnitPriceCents);
  assert.notEqual(result.items[0].unit_amount_cents, 1);
});

test("invalid quantities are rejected (zero, negative, NaN, too large)", () => {
  for (const quantity of [0, -3, "abc", NaN, 99999]) {
    expectReject([realProductCartLine({ quantity })], "invalid_quantity");
  }
});

test("an unknown product id is rejected", () => {
  expectReject([{ productId: "does-not-exist-xyz", quantity: 1 }], "product_unavailable");
});

test("manual order mode accepts an unpublished cart product with review metadata", () => {
  expectReject(
    [
      {
        productId: "manual-product-not-in-checkout-catalog",
        name: "Manual Catalog Product",
        brand: "Test Brand",
        price: 19.99,
        currency: "USD",
        quantity: 1,
      },
    ],
    "product_unavailable"
  );

  const result = evaluateCart(
    [
      {
        productId: "manual-product-not-in-checkout-catalog",
        name: "Manual Catalog Product",
        brand: "Test Brand",
        price: 19.99,
        currency: "USD",
        image: "https://example.com/manual-product.png",
        quantity: 2,
      },
    ],
    { allowManualOrder: true }
  );

  assert.equal(result.valid, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].product_id, "manual-product-not-in-checkout-catalog");
  assert.equal(result.items[0].unit_amount_cents, 1999);
  assert.equal(result.subtotalCents, 3998);
  assert.equal(result.items[0].product_snapshot.manual_order, true);
  assert.equal(result.items[0].product_snapshot.requires_order_review, true);
});

test("an empty cart is rejected", () => {
  expectReject([], "empty_cart");
});

test("a product explicitly marked purchasable:false is still rejected", () => {
  expectReject([{ productId: SYN_UNPURCHASABLE, quantity: 1 }], "product_unavailable");
});

test("an unavailable product is rejected", () => {
  expectReject([{ productId: SYN_UNAVAILABLE, quantity: 1 }], "product_unavailable");
});

test("a priced product validates even when an old availability flag is false", () => {
  const result = validateCart([
    { productId: SYN_FLAGGED_UNAVAILABLE_WITH_PRICE, quantity: 1 },
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unit_amount_cents, 1234);
});

test("a variant-required product with no chosen option is rejected", () => {
  expectReject([{ productId: SYN_VARIANT, quantity: 1 }], "variant_required");
  expectReject(
    [{ productId: SYN_VARIANT, quantity: 1, variant: "   " }],
    "variant_required"
  );
});

test("a variant-required product with a chosen option validates and carries the label", () => {
  const result = validateCart([
    { productId: SYN_VARIANT, quantity: 1, variant: "Cookies N Cream" },
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].variant, "Cookies N Cream");
  // Price is the flat catalog price regardless of the chosen option.
  assert.equal(result.items[0].unit_amount_cents, 4999);
  assert.equal(result.items[0].product_snapshot.variant_title, "Cookies N Cream");
});

test("manual order mode accepts a stale selected variant without changing strict checkout validation", () => {
  expectReject(
    [
      {
        productId: SYN_MANUAL_VARIANT,
        variant_id: "stale-variant",
        variant: "Legacy Option",
        quantity: 1,
      },
    ],
    "variant_unavailable"
  );

  const result = evaluateCart(
    [
      {
        productId: SYN_MANUAL_VARIANT,
        variant_id: "stale-variant",
        variant: "Legacy Option",
        quantity: 2,
      },
    ],
    { allowManualOrder: true }
  );
  assert.equal(result.valid, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].variant, "Legacy Option");
  assert.equal(result.items[0].unit_amount_cents, 2500);
  assert.equal(result.subtotalCents, 5000);
});

test("distinct chosen options of the same product stay separate lines", () => {
  const result = validateCart([
    { productId: SYN_VARIANT, quantity: 1, variant: "Vanilla" },
    { productId: SYN_VARIANT, quantity: 1, variant: "Chocolate" },
  ]);
  assert.equal(result.items.length, 2);
  const labels = result.items.map((i) => i.variant).sort();
  assert.deepEqual(labels, ["Chocolate", "Vanilla"]);
});

test("evaluateCart returns structured line validation and partial subtotal", () => {
  const result = evaluateCart([
    realProductCartLine({ quantity: 2 }),
    { productId: SYN_UNAVAILABLE, quantity: 1 },
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.code, "product_unavailable");
  assert.equal(result.message, "One of the products in your cart is not ready for checkout.");
  assert.equal(result.items.length, 1);
  assert.equal(result.invalidItems.length, 1);
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.lineItems[0].valid, true);
  assert.equal(result.lineItems[1].valid, false);
  assert.equal(
    result.lineItems[1].message,
    "One of the products in your cart is not ready for checkout."
  );
  assert.equal(result.subtotalCents, realProductUnitPriceCents * 2);
});
