"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const catalogData = require("../data/athletonic-catalog.json");
const { validateCartWithOverrides } = require("../api/_lib/catalog.js");

const VARIANT_PRODUCT = catalogData.products.find(
  (product) => Array.isArray(product.variants) && product.variants.length > 1
);

assert.ok(VARIANT_PRODUCT, "expected a catalog product with multiple variants");

const SOURCE_VARIANT = VARIANT_PRODUCT.variants.find(
  (variant) => Number(variant.price_cents) > 0
) || VARIANT_PRODUCT.variants[0];

assert.ok(SOURCE_VARIANT, "expected a concrete source variant");

function createSupabase(overrides) {
  return {
    from(table) {
      if (table === "product_overrides") {
        return {
          select(columns) {
            assert.equal(columns, "product_id, patch, hidden");
            return {
              in(column, values) {
                assert.equal(column, "product_id");
                const allowed = new Set(values.map(String));
                return Promise.resolve({
                  data: overrides.filter((row) => allowed.has(String(row.product_id))),
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "product_variant_price_overrides") {
        return {
          select(columns) {
            assert.equal(
              columns,
              "product_id, variant_id, regular_price_cents, offer_price_cents, offer_enabled"
            );
            return {
              in(column, values) {
                assert.equal(column, "product_id");
                assert.ok(Array.isArray(values));
                return Promise.resolve({
                  data: [],
                  error: null,
                });
              },
            };
          },
        };
      }

      assert.fail(`unexpected table ${table}`);
    },
  };
}

test("variant overrides replace checkout pricing and imagery", async () => {
  const overridePriceCents = Number(SOURCE_VARIANT.price_cents) + 321;
  const overrideImage = "https://cdn.example.com/live-variant-override.png";

  const result = await validateCartWithOverrides(
    [
      {
        productId: String(VARIANT_PRODUCT.id),
        variant_id: String(SOURCE_VARIANT.variant_id),
        quantity: 2,
      },
    ],
    {
      supabase: createSupabase([
        {
          product_id: String(VARIANT_PRODUCT.id),
          patch: {
            variant_overrides: {
              [String(SOURCE_VARIANT.variant_id)]: {
                price_cents: overridePriceCents,
                image_url: overrideImage,
                available: true,
              },
            },
          },
          hidden: false,
        },
      ]),
    }
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unit_amount_cents, overridePriceCents);
  assert.equal(result.items[0].public_unit_amount_cents, overridePriceCents);
  assert.equal(result.items[0].image_url, overrideImage);
  assert.equal(result.items[0].product_snapshot.image_url, overrideImage);
  assert.equal(result.subtotalCents, overridePriceCents * 2);
});

test("variant overrides can make a previously valid selection unavailable", async () => {
  await assert.rejects(
    () =>
      validateCartWithOverrides(
        [
          {
            productId: String(VARIANT_PRODUCT.id),
            variant_id: String(SOURCE_VARIANT.variant_id),
            quantity: 1,
          },
        ],
        {
          supabase: createSupabase([
            {
              product_id: String(VARIANT_PRODUCT.id),
              patch: {
                variant_overrides: {
                  [String(SOURCE_VARIANT.variant_id)]: {
                    available: false,
                    price_cents: Number(SOURCE_VARIANT.price_cents) || 1000,
                  },
                },
              },
              hidden: false,
            },
          ]),
        }
      ),
    (error) => {
      assert.equal(error.code, "variant_unavailable");
      return true;
    }
  );
});
