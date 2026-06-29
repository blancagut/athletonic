"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { Readable } = require("node:stream");

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

function createJsonRequest(method, query, body) {
  const payload = Buffer.from(JSON.stringify(body || {}));
  const req = Readable.from([payload]);
  req.method = method;
  req.url = "/api/admin/variant-pricing/test";
  req.query = query || {};
  req.headers = { "content-type": "application/json" };
  return req;
}

function createGetRequest(url, query) {
  return {
    method: "GET",
    url,
    query: query || {},
    headers: {},
  };
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

function createVariantPricingSupabase(options = {}) {
  const state = {
    upserts: [],
    deletes: [],
  };
  const rowsByProduct = new Map(
    Object.entries(options.rowsByProduct || {}).map(([productId, rows]) => [String(productId), rows])
  );

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.pendingUpsert = null;
      this.deleteMode = false;
      this.selectedColumns = "";
      this.inFilter = null;
    }

    select(columns) {
      this.selectedColumns = columns || "";
      return this;
    }

    in(column, values) {
      this.inFilter = { column, values };
      const rows = values.flatMap((value) => rowsByProduct.get(String(value)) || []);
      return Promise.resolve({ data: rows, error: null });
    }

    eq(column, value) {
      this.filters.push([column, value]);
      return this;
    }

    upsert(rows, optionsArg) {
      const payload = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [{ ...rows }];
      state.upserts.push({ table: this.table, rows: payload, options: optionsArg });
      payload.forEach((row) => {
        const productId = String(row.product_id);
        const current = (rowsByProduct.get(productId) || []).filter(
          (entry) => String(entry.variant_id) !== String(row.variant_id)
        );
        current.push({ ...row });
        rowsByProduct.set(productId, current);
      });
      this.pendingUpsert = payload;
      return this;
    }

    delete() {
      this.deleteMode = true;
      return this;
    }

    then(resolve, reject) {
      if (!this.deleteMode) {
        if (this.pendingUpsert) {
          return Promise.resolve({ data: this.pendingUpsert, error: null }).then(resolve, reject);
        }
        const productId = this.filters.find(([column]) => column === "product_id")?.[1];
        const rows = productId ? rowsByProduct.get(String(productId)) || [] : [];
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      }
      const productId = this.filters.find(([column]) => column === "product_id")?.[1];
      const variantId = this.filters.find(([column]) => column === "variant_id")?.[1];
      state.deletes.push({
        table: this.table,
        filters: this.filters.map(([column, value]) => ({ column, value })),
      });
      if (productId && variantId) {
        rowsByProduct.set(
          String(productId),
          (rowsByProduct.get(String(productId)) || []).filter(
            (row) => String(row.variant_id) !== String(variantId)
          )
        );
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }

    single() {
      return Promise.resolve({
        data: this.pendingUpsert ? this.pendingUpsert[0] : null,
        error: null,
      });
    }
  }

  return {
    state,
    client: {
      from(table) {
        assert.equal(
          table,
          "product_variant_price_overrides",
          "unexpected table access in variant pricing tests"
        );
        return new Query(table);
      },
    },
  };
}

const sourceProductDetail = {
  id: String(VARIANT_PRODUCT.id),
  brand_slug: VARIANT_PRODUCT.brand_slug || "test_brand",
  brand: VARIANT_PRODUCT.brand || "Test Brand",
  name: VARIANT_PRODUCT.name,
  sku: VARIANT_PRODUCT.sku || null,
  currency: VARIANT_PRODUCT.currency || "USD",
  variants: VARIANT_PRODUCT.variants.slice(0, 2).map((variant) => ({
    variant_id: String(variant.variant_id),
    title: variant.title,
    sku: variant.sku || null,
    available: variant.available !== false,
    price_cents: Number(variant.price_cents) || 0,
    compare_at_price_cents: Number(variant.compare_at_price_cents) || 0,
    option_values: Array.isArray(variant.option_values) ? variant.option_values : [],
  })),
};

test("GET /api/admin/variant-pricing rejects non-super-admin access", async () => {
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "index.js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => {
          const error = new Error("This action requires super admin access.");
          error.statusCode = 403;
          error.code = "forbidden_super_admin";
          throw error;
        },
      },
    }
  );

  const res = createResponseCapture();
  await handler(createGetRequest("/api/admin/variant-pricing", { search: "whey" }), res);
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 403);
  assert.equal(payload.error, "forbidden_super_admin");
});

test("GET /api/admin/variant-pricing returns paginated summaries", async () => {
  const supabase = createVariantPricingSupabase({
    rowsByProduct: {
      "101": [
        { product_id: "101", variant_id: "v1", offer_enabled: true },
        { product_id: "101", variant_id: "v2", offer_enabled: false },
      ],
    },
  });
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "index.js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({ role: "super_admin", user: { id: "u1" } }),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
      [path.join(__dirname, "..", "api", "_lib", "source-product-admin.js")]: {
        searchSourceProducts: () => ({
          products: [
            {
              id: "101",
              brand: "Test Brand",
              name: "Product One",
              sku: "SKU-101",
              currency: "USD",
              product_price_cents: 1200,
              variant_count: 2,
              min_variant_price_cents: 1000,
              max_variant_price_cents: 1400,
            },
          ],
          pagination: { page: 1, page_size: 25, total: 1 },
        }),
      },
    }
  );

  const res = createResponseCapture();
  await handler(createGetRequest("/api/admin/variant-pricing", { search: "Product" }), res);
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 200);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].override_variant_count, 2);
  assert.equal(payload.products[0].active_offer_variant_count, 1);
});

test("GET /api/admin/variant-pricing/[id] returns merged variant pricing detail", async () => {
  const variantId = sourceProductDetail.variants[0].variant_id;
  const supabase = createVariantPricingSupabase({
    rowsByProduct: {
      [sourceProductDetail.id]: [
        {
          product_id: sourceProductDetail.id,
          variant_id: variantId,
          regular_price_cents: 2999,
          offer_price_cents: 2499,
          offer_enabled: true,
        },
      ],
    },
  });
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({ role: "super_admin", user: { id: "u1" } }),
        logAudit: async () => {},
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
      [path.join(__dirname, "..", "api", "_lib", "source-product-admin.js")]: {
        getSourceProductDetail: () => sourceProductDetail,
      },
    }
  );

  const res = createResponseCapture();
  await handler(createGetRequest("/api/admin/variant-pricing/test", { id: sourceProductDetail.id }), res);
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 200);
  assert.equal(payload.product.variants[0].regular_price_cents, 2999);
  assert.equal(payload.product.variants[0].offer_price_cents, 2499);
  assert.equal(payload.product.variants[0].effective_price_cents, 2499);
  assert.equal(payload.product.variants[0].effective_compare_at_price_cents, 2999);
  assert.equal(payload.product.variants[1]._override, false);
});

test("PATCH /api/admin/variant-pricing/[id] upserts variant prices", async () => {
  const audits = [];
  const supabase = createVariantPricingSupabase();
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({
          role: "super_admin",
          user: { id: "u1", email: "owner@example.com" },
        }),
        logAudit: async (...args) => audits.push(args),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
      [path.join(__dirname, "..", "api", "_lib", "source-product-admin.js")]: {
        getSourceProductDetail: () => sourceProductDetail,
      },
    }
  );

  const res = createResponseCapture();
  await handler(
    createJsonRequest(
      "PATCH",
      { id: sourceProductDetail.id },
      {
        variants: [
          {
            variant_id: sourceProductDetail.variants[0].variant_id,
            regular_price_cents: 3200,
            offer_price_cents: 2800,
            offer_enabled: true,
          },
        ],
      }
    ),
    res
  );
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 200);
  assert.equal(supabase.state.upserts.length, 1);
  assert.equal(payload.product.variants[0].effective_price_cents, 2800);
  assert.equal(audits.length, 1);
  assert.equal(audits[0][1], "variant_pricing.upsert");
});

test("DELETE /api/admin/variant-pricing/[id] resets one variant override", async () => {
  const audits = [];
  const variantId = sourceProductDetail.variants[0].variant_id;
  const supabase = createVariantPricingSupabase({
    rowsByProduct: {
      [sourceProductDetail.id]: [
        {
          product_id: sourceProductDetail.id,
          variant_id: variantId,
          regular_price_cents: 3200,
          offer_price_cents: null,
          offer_enabled: false,
        },
      ],
    },
  });
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({ role: "super_admin", user: { id: "u1" } }),
        logAudit: async (...args) => audits.push(args),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
      [path.join(__dirname, "..", "api", "_lib", "source-product-admin.js")]: {
        getSourceProductDetail: () => sourceProductDetail,
      },
    }
  );

  const res = createResponseCapture();
  const req = createGetRequest(
    `/api/admin/variant-pricing/${sourceProductDetail.id}?variant_id=${variantId}`,
    { id: sourceProductDetail.id, variant_id: variantId }
  );
  req.method = "DELETE";
  await handler(
    req,
    res
  );
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 200);
  assert.equal(payload.variant_id, variantId);
  assert.equal(supabase.state.deletes.length, 1);
  assert.equal(audits[0][1], "variant_pricing.reset");
});

test("PATCH /api/admin/variant-pricing/[id] rejects unsupported fields", async () => {
  const supabase = createVariantPricingSupabase();
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "variant-pricing", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({ role: "super_admin", user: { id: "u1" } }),
        logAudit: async () => {},
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
      [path.join(__dirname, "..", "api", "_lib", "source-product-admin.js")]: {
        getSourceProductDetail: () => sourceProductDetail,
      },
    }
  );

  const res = createResponseCapture();
  await handler(
    createJsonRequest(
      "PATCH",
      { id: sourceProductDetail.id },
      {
        variants: [
          {
            variant_id: sourceProductDetail.variants[0].variant_id,
            regular_price_cents: 3200,
            image_url: "https://bad.example.com/image.png",
          },
        ],
      }
    ),
    res
  );
  const payload = readJsonResponse(res);

  assert.equal(res.statusCode, 400);
  assert.equal(payload.error, "unsupported_variant_field");
});

test("loadProductsWithOverrides applies variant pricing without changing product content", async () => {
  const { loadProductsWithOverrides } = require("../api/_lib/catalog.js");
  const sourceVariant = VARIANT_PRODUCT.variants[0];
  const result = await loadProductsWithOverrides([String(VARIANT_PRODUCT.id)], {
    supabase: {
      from(table) {
        if (table === "product_overrides") {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        }
        if (table === "product_variant_price_overrides") {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({
                    data: [
                      {
                        product_id: String(VARIANT_PRODUCT.id),
                        variant_id: String(sourceVariant.variant_id),
                        regular_price_cents: 9000,
                        offer_price_cents: 7500,
                        offer_enabled: true,
                      },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].name, VARIANT_PRODUCT.name);
  assert.equal(
    result[0].variants[0].price_cents,
    7500
  );
  assert.equal(result[0].variants[0].compare_at_price_cents, 9000);
});
