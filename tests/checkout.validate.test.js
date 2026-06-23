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
// level, which runs before any test registers.
const catalogData = require("../data/athletonic-catalog.json");

const SYN_UNPURCHASABLE = "__test_unpurchasable__";
const SYN_UNAVAILABLE = "__test_unavailable__";

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
  name: "Synthetic Unavailable",
  price_cents: 1234,
  currency: "USD",
  available: false,
});

const { validateCart } = require("../api/_lib/catalog.js");

const realProduct = catalogData.products.find(
  (p) =>
    p.id !== SYN_UNPURCHASABLE &&
    p.id !== SYN_UNAVAILABLE &&
    Number(p.price_cents) > 0 &&
    p.available === true &&
    p.requires_variant_selection !== true
);

assert.ok(realProduct, "expected at least one sellable product in the catalog");

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
  const result = validateCart([
    { productId: String(realProduct.id), quantity: 2 },
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unit_amount_cents, realProduct.price_cents);
  assert.equal(result.subtotalCents, realProduct.price_cents * 2);
});

test("a client-supplied price is ignored in favor of the server price", () => {
  const result = validateCart([
    {
      productId: String(realProduct.id),
      quantity: 1,
      price: 1,
      price_cents: 1,
      unit_amount_cents: 1,
    },
  ]);
  assert.equal(result.items[0].unit_amount_cents, realProduct.price_cents);
  assert.notEqual(result.items[0].unit_amount_cents, 1);
});

test("invalid quantities are rejected (zero, negative, NaN, too large)", () => {
  for (const quantity of [0, -3, "abc", NaN, 99999]) {
    expectReject(
      [{ productId: String(realProduct.id), quantity }],
      "invalid_quantity"
    );
  }
});

test("an unknown product id is rejected", () => {
  expectReject([{ productId: "does-not-exist-xyz", quantity: 1 }], "product_unavailable");
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
