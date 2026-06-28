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
  (product) => String(product.id) === "443" || Array.isArray(product.variants) && product.variants.length > 1
);

assert.ok(VARIANT_PRODUCT, "expected a catalog product with variants for admin catalog tests");

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
  req.url = "/api/admin/catalog/test";
  req.query = query || {};
  req.headers = { "content-type": "application/json" };
  return req;
}

function createGetRequest(query) {
  return {
    method: "GET",
    url: "/api/admin/catalog",
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

function createCatalogMutationSupabase(existingOverridePatch = null) {
  const state = {
    upserts: [],
    deletes: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.upsertRow = null;
      this.deleteMode = false;
      this.eqFilters = [];
    }

    upsert(row, options) {
      this.upsertRow = { ...row };
      state.upserts.push({ table: this.table, row: { ...row }, options });
      return this;
    }

    select() {
      return this;
    }

    single() {
      return Promise.resolve({
        data: {
          product_id: this.upsertRow.product_id,
          patch: this.upsertRow.patch,
          hidden: Boolean(this.upsertRow.hidden),
          updated_at: this.upsertRow.updated_at,
        },
        error: null,
      });
    }

    maybeSingle() {
      return Promise.resolve({
        data: existingOverridePatch == null ? null : { patch: existingOverridePatch },
        error: null,
      });
    }

    delete() {
      this.deleteMode = true;
      return this;
    }

    eq(column, value) {
      this.eqFilters.push([column, value]);
      return this;
    }

    then(resolve, reject) {
      if (this.deleteMode) {
        state.deletes.push({
          table: this.table,
          filters: this.eqFilters.map(([column, value]) => ({ column, value })),
        });
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
  }

  return {
    state,
    client: {
      from(table) {
        return new Query(table);
      },
    },
  };
}

function createCatalogIndexSupabase(overrides) {
  return {
    client: {
      from(table) {
        assert.equal(table, "product_overrides");
        return {
          select() {
            return Promise.resolve({
              data: overrides.map((row) => ({ ...row })),
              error: null,
            });
          },
        };
      },
    },
  };
}

test("PATCH /api/admin/catalog/[id] stores only supported override fields", async () => {
  const audits = [];
  const supabase = createCatalogMutationSupabase();
  const variantId = String(VARIANT_PRODUCT.variants[0].variant_id);
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "catalog", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({
          user: { id: "admin-user", email: "admin@example.com" },
          profile: { email: "admin@example.com" },
          role: "super_admin",
        }),
        logAudit: async (...args) => audits.push(args),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
    }
  );

  const req = createJsonRequest(
    "PATCH",
    { id: String(VARIANT_PRODUCT.id) },
    {
      name: "  Admin Override Name  ",
      price_cents: "12345",
      available: 0,
      image: "https://cdn.example.com/override.png",
      url: "https://example.com/updated-product ",
      hidden: true,
      variant_overrides: {
        [variantId]: {
          price_cents: "23456",
          available: "false",
          image_url: "https://cdn.example.com/variant-override.png",
          sku: "ignored",
        },
      },
      default_variant_id: "should-be-ignored",
      variants: [{ variant_id: "bad" }],
    }
  );
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(payload.override.patch, {
    name: "Admin Override Name",
    price_cents: 12345,
    available: false,
    image: "https://cdn.example.com/override.png",
    url: "https://example.com/updated-product",
    variant_overrides: {
      [variantId]: {
        price_cents: 23456,
        available: false,
        image_url: "https://cdn.example.com/variant-override.png",
      },
    },
  });
  assert.equal(payload.override.hidden, true);
  assert.equal(supabase.state.upserts.length, 1);
  assert.deepEqual(supabase.state.upserts[0].row.patch, payload.override.patch);
  assert.equal(supabase.state.upserts[0].row.product_id, String(VARIANT_PRODUCT.id));
  assert.ok(!("default_variant_id" in supabase.state.upserts[0].row.patch));
  assert.ok(!("variants" in supabase.state.upserts[0].row.patch));
  assert.equal(audits.length, 1);
  assert.equal(audits[0][1], "catalog.override");
});

test("PATCH /api/admin/catalog/[id] preserves existing variant overrides on top-level updates", async () => {
  const variantId = String(VARIANT_PRODUCT.variants[0].variant_id);
  const existingVariantOverrides = {
    [variantId]: {
      price_cents: 6543,
      available: true,
      image_url: "https://cdn.example.com/existing-variant.png",
    },
  };
  const supabase = createCatalogMutationSupabase({
    variant_overrides: existingVariantOverrides,
  });
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "catalog", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({
          user: { id: "admin-user", email: "admin@example.com" },
          profile: { email: "admin@example.com" },
          role: "super_admin",
        }),
        logAudit: async () => {},
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
    }
  );

  const req = createJsonRequest("PATCH", { id: String(VARIANT_PRODUCT.id) }, { name: "Refreshed Name" });
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.override.patch.name, "Refreshed Name");
  assert.deepEqual(payload.override.patch.variant_overrides, existingVariantOverrides);
  assert.deepEqual(
    supabase.state.upserts[0].row.patch.variant_overrides,
    existingVariantOverrides
  );
});

test("PATCH /api/admin/catalog/[id] rejects bodies with no supported changes", async () => {
  const supabase = createCatalogMutationSupabase();
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "catalog", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({
          user: { id: "admin-user", email: "admin@example.com" },
          profile: { email: "admin@example.com" },
          role: "super_admin",
        }),
        logAudit: async () => {},
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
    }
  );

  const req = createJsonRequest("PATCH", { id: String(VARIANT_PRODUCT.id) }, { variants: [] });
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 400);
  assert.equal(payload.error, "nothing_to_update");
  assert.equal(supabase.state.upserts.length, 0);
});

test("DELETE /api/admin/catalog/[id] resets the override for one product", async () => {
  const audits = [];
  const supabase = createCatalogMutationSupabase();
  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "catalog", "[id].js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireSuperAdmin: async () => ({
          user: { id: "admin-user", email: "admin@example.com" },
          profile: { email: "admin@example.com" },
          role: "super_admin",
        }),
        logAudit: async (...args) => audits.push(args),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => supabase.client,
      },
    }
  );

  const req = createJsonRequest("DELETE", { id: String(VARIANT_PRODUCT.id) }, {});
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(payload, {
    ok: true,
    product_id: String(VARIANT_PRODUCT.id),
    override: null,
  });
  assert.equal(supabase.state.deletes.length, 1);
  assert.deepEqual(supabase.state.deletes[0].filters, [
    { column: "product_id", value: String(VARIANT_PRODUCT.id) },
  ]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0][1], "catalog.override_reset");
});

test("GET /api/admin/catalog preserves variant metadata when overrides are applied", async () => {
  const sourceProduct = VARIANT_PRODUCT;
  const overrides = [
    {
      product_id: String(sourceProduct.id),
      patch: { name: `${sourceProduct.name} (Override)`, price_cents: 7777 },
      hidden: true,
      updated_at: "2026-06-28T12:00:00.000Z",
    },
  ];

  const handler = withMockedModules(
    path.join(__dirname, "..", "api", "admin", "catalog", "index.js"),
    {
      [path.join(__dirname, "..", "api", "_lib", "auth.js")]: {
        requireAdmin: async () => ({
          user: { id: "admin-user", email: "admin@example.com" },
          profile: { email: "admin@example.com" },
          role: "admin",
        }),
      },
      [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
        getSupabaseAdmin: () => createCatalogIndexSupabase(overrides).client,
      },
    }
  );

  const req = createGetRequest({
    availability: "hidden",
    override_state: "edited",
    search: sourceProduct.name,
  });
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.pagination.total, 1);
  assert.equal(payload.products[0].id, sourceProduct.id);
  assert.equal(payload.products[0].name, `${sourceProduct.name} (Override)`);
  assert.equal(payload.products[0]._source_name, sourceProduct.name);
  assert.equal(payload.products[0]._source_price_cents, sourceProduct.price_cents);
  assert.equal(payload.products[0]._override, true);
  assert.equal(payload.products[0]._hidden, true);
  assert.equal(
    payload.products[0].variant_count,
    Array.isArray(sourceProduct.variants) ? sourceProduct.variants.length : 0
  );
  assert.equal(payload.products[0].default_variant_id, sourceProduct.default_variant_id);
  assert.ok(Array.isArray(payload.facets.brands));
  assert.ok(Array.isArray(payload.facets.sections));
});
