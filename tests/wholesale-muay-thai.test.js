"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { Readable } = require("node:stream");

const catalogData = require("../data/wholesale-muay-thai-catalog.json");

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-resend-key";
process.env.ATHLETONIC_SUPPORT_EMAIL = process.env.ATHLETONIC_SUPPORT_EMAIL || "support@example.com";

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

function createJsonRequest(method, query, body) {
  const payload = Buffer.from(JSON.stringify(body || {}));
  const req = Readable.from([payload]);
  req.method = method;
  req.url = "/api/wholesale/test";
  req.query = query || {};
  req.headers = {
    "content-type": "application/json",
    host: "athletonic.test",
    "x-forwarded-proto": "https",
  };
  return req;
}

test("GET /api/wholesale/catalog returns wholesale products without price fields", async () => {
  const sampleProduct = catalogData.products.find((product) => product.brand_slug === "fairtex");
  assert.ok(sampleProduct, "expected a fairtex wholesale catalog product");

  const handler = require("../api/wholesale/catalog.js");
  const req = {
    method: "GET",
    url: "/api/wholesale/catalog?brand=fairtex&page_size=1",
    query: { brand: "fairtex", page_size: "1" },
    headers: {},
  };
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].brand_slug, "fairtex");
  assert.ok(!("price" in payload.products[0]));
  assert.ok(!("price_cents" in payload.products[0]));
  assert.ok(!("cost" in payload.products[0]));
  assert.ok(Array.isArray(payload.facets.brands));
  assert.ok(Array.isArray(payload.facets.categories));
});

test("POST /api/wholesale/quote-requests stores sanitized items and notifies admins", async () => {
  const sampleProduct = catalogData.products.find(
    (product) => Array.isArray(product.sizes) && product.sizes.length > 0
  );
  assert.ok(sampleProduct, "expected a product with sizes for quote request tests");

  const inserts = [];
  const notifications = [];
  const handler = withMockedModules(path.join(__dirname, "..", "api", "wholesale", "quote-requests.js"), {
    [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
      getSupabaseAdmin: () => ({
        from() {
          return {
            insert(row) {
              inserts.push(row);
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({
                        data: { id: "quote-request-1", created_at: "2026-06-30T00:00:00.000Z" },
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        },
      }),
    },
    [path.join(__dirname, "..", "api", "_lib", "email.js")]: {
      sendWholesaleQuoteRequestEmail: async (payload) => {
        notifications.push(payload);
        return { id: "email-1" };
      },
    },
  });

  const req = createJsonRequest(
    "POST",
    {},
    {
      name: "Alex Buyer",
      company_name: "Warehouse Athletics",
      email: "alex@example.com",
      whatsapp: "+1 555 111 2222",
      country: "United States",
      notes: "Looking for mixed fight gear.",
      items: [
        {
          product_id: String(sampleProduct.id),
          quantity: 3,
          selected_options: {
            Size: sampleProduct.sizes[0],
          },
        },
      ],
      source_page: "/catalog/wholesale-muay-thai",
    }
  );
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 201);
  assert.equal(payload.ok, true);
  assert.equal(payload.notification_sent, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].item_count, 1);
  assert.equal(inserts[0].quantity_count, 3);
  assert.equal(inserts[0].items[0].product_id, String(sampleProduct.id));
  assert.equal(inserts[0].items[0].quantity, 3);
  assert.ok(!("price" in inserts[0].items[0]));
  assert.ok(!("price_cents" in inserts[0].items[0]));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientEmail, "support@example.com");
});
