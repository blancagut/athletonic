"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const catalogData = require("../data/athletonic-catalog.json");

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";

const VARIANT_PRODUCT = catalogData.products.find(
  (product) => Array.isArray(product.variants) && product.variants.length > 1
);

assert.ok(VARIANT_PRODUCT, "expected a catalog product with variants");

function createResponseCapture() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload = "") {
      this.body += payload;
    },
  };
}

function readJsonResponse(res) {
  assert.ok(res.body, "expected JSON response body");
  return JSON.parse(res.body);
}

function withMockedModules(targetPath, mockEntries) {
  const targetResolved = require.resolve(targetPath);
  const originals = new Map();

  for (const [modulePath, mockExports] of Object.entries(mockEntries)) {
    const resolved = require.resolve(modulePath);
    originals.set(resolved, require.cache[resolved]);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: mockExports,
    };
  }

  delete require.cache[targetResolved];

  try {
    return require(targetResolved);
  } finally {
    delete require.cache[targetResolved];
    for (const [resolved, original] of originals.entries()) {
      if (original) require.cache[resolved] = original;
      else delete require.cache[resolved];
    }
  }
}

test("GET /api/catalog/products returns merged live variant overrides", async () => {
  const variantId = String(VARIANT_PRODUCT.variants[0].variant_id);
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "catalog", "products.js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => ({
          from(table) {
            if (table === "product_overrides") {
              return {
                select(columns) {
                  assert.equal(columns, "product_id, patch, hidden");
                  return {
                    in(column, values) {
                      assert.equal(column, "product_id");
                      assert.deepEqual(values, [String(VARIANT_PRODUCT.id)]);
                      return Promise.resolve({
                        data: [
                          {
                            product_id: String(VARIANT_PRODUCT.id),
                            patch: {
                              name: VARIANT_PRODUCT.name + " Live",
                              variant_overrides: {
                                [variantId]: {
                                  price_cents: 4321,
                                  available: false,
                                  image_url: "https://cdn.example.com/live-override.png",
                                },
                              },
                            },
                            hidden: false,
                          },
                        ],
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
                      assert.deepEqual(values, [String(VARIANT_PRODUCT.id)]);
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
        }),
      },
    }
  );

  const req = {
    method: "GET",
    url: "/api/catalog/products?ids=" + encodeURIComponent(String(VARIANT_PRODUCT.id)),
    query: { ids: String(VARIANT_PRODUCT.id) },
    headers: {},
  };
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].name, VARIANT_PRODUCT.name + " Live");
  assert.equal(payload.products[0].variants[0].variant_id, variantId);
  assert.equal(payload.products[0].variants[0].price_cents, 4321);
  assert.equal(payload.products[0].variants[0].available, false);
  assert.equal(
    payload.products[0].variants[0].image_url,
    "https://cdn.example.com/live-override.png"
  );
});
