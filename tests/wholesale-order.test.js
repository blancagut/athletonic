"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

const catalogData = require("../data/wholesale-muay-thai-catalog.json");

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-resend-key";
process.env.ATHLETONIC_SALES_EMAIL = process.env.ATHLETONIC_SALES_EMAIL || "sales@athletonic.com";

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

function createJsonRequest(method, body) {
  const payload = Buffer.from(JSON.stringify(body || {}));
  const req = Readable.from([payload]);
  req.method = method;
  req.url = "/api/wholesale/quote-requests?order=1";
  req.query = { order: "1" };
  req.headers = {
    "content-type": "application/json",
    "x-athletonic-order-request": "1",
    host: "athletonic.test",
    "x-forwarded-proto": "https",
    "user-agent": "node-test",
  };
  return req;
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

test("/order keeps the account number out of initial HTML", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pages", "pedido.html"), "utf8");
  assert.equal(html.includes("279027375786136"), false);
  assert.ok(html.includes("https://athletonic.com/order"), "order page must publish the canonical /order URL");
  assert.ok(html.includes("data-stock-preset=\"gloves\""), "order page must expose automatic stock presets");
  assert.ok(html.includes("Loading catalog"), "order page should load the catalog before the customer types");
  assert.ok(html.includes("data-currency-select"), "order page must include local currency converter");
  assert.ok(html.includes("min=\"1\""), "manual order quantities must allow unit orders");
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  assert.equal(/mayorista|mayoreo|wholesale/i.test(visibleText), false);
});

test("POST /api/wholesale/order-requests stores order, proof, and emails invoice", async () => {
  const sampleProduct = catalogData.products.find(
    (product) => product.retail_price_cents && Array.isArray(product.sizes) && product.sizes.length
  );
  assert.ok(sampleProduct, "expected a priced product with sizes");

  const uploads = [];
  const inserts = [];
  const buyerEmails = [];
  const salesEmails = [];
  const handler = withMockedModules(path.join(__dirname, "..", "api", "wholesale", "quote-requests.js"), {
    [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
      getSupabaseAdmin: () => ({
        storage: {
          getBucket: async () => ({ data: { name: "wholesale-order-proofs" }, error: null }),
          createBucket: async () => ({ data: null, error: null }),
          from(bucket) {
            return {
              upload(storagePath, buffer, options) {
                uploads.push({ bucket, storagePath, buffer, options });
                return Promise.resolve({ data: { path: storagePath }, error: null });
              },
            };
          },
        },
        from(table) {
          assert.equal(table, "wholesale_quote_requests");
          return {
            insert(row) {
              inserts.push(row);
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({
                        data: { id: row.id, created_at: "2026-07-04T00:00:00.000Z" },
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
      sendWholesaleOrderBuyerEmail: async (payload) => {
        buyerEmails.push(payload);
        return { id: "buyer-email" };
      },
      sendWholesaleOrderSalesEmail: async (payload) => {
        salesEmails.push(payload);
        return { id: "sales-email" };
      },
    },
  });

  const proofBuffer = Buffer.from("fake-image");
  const req = createJsonRequest("POST", {
    name: "Alex Buyer",
    company_name: "Warehouse Athletics",
    email: "alex@example.com",
    whatsapp: "+1 555 111 2222",
    country: "United States",
    billing: {
      legal_name: "Warehouse Athletics LLC",
      tax_id: "TAX-1",
      address_line1: "100 Market St",
      city: "Miami",
      country: "United States",
    },
    shipping: {
      address_line1: "200 Gym Ave",
      city: "Miami",
      country: "United States",
    },
    payment_method: "bank_transfer",
    payment_proof: {
      filename: "proof.png",
      mime_type: "image/png",
      data_base64: proofBuffer.toString("base64"),
    },
    items: [
      {
        product_id: String(sampleProduct.id),
        quantity: 12,
        selected_options: { Size: sampleProduct.sizes[0] },
      },
      {
        custom: true,
        name: "Shorts custom colorway",
        brand: "Athletonic",
        category_label: "Shorts",
        quantity: 24,
        selected_options: { Size: "L", Color: "Black/Gold" },
      },
    ],
    source_page: "/order",
  });
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 201);
  assert.equal(payload.ok, true);
  assert.match(payload.invoice_reference, /^AWE-[0-9A-F]+$/);
  assert.equal(payload.buyer_email_sent, true);
  assert.equal(payload.sales_email_sent, true);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].bucket, "wholesale-order-proofs");
  assert.equal(uploads[0].buffer.toString(), "fake-image");
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].source_page, "/order");
  assert.equal(inserts[0].metadata.request_type, "unit_order");
  assert.equal(inserts[0].metadata.payment_proof.path.endsWith("/proof.png"), true);
  assert.equal(inserts[0].item_count, 2);
  assert.equal(inserts[0].quantity_count, 36);
  assert.equal(buyerEmails.length, 1);
  assert.ok(Buffer.isBuffer(buyerEmails[0].invoicePdf.buffer), "buyer email must include invoice PDF");
  assert.equal(buyerEmails[0].invoicePdf.buffer.subarray(0, 5).toString(), "%PDF-");
  assert.equal(salesEmails.length, 1);
  assert.deepEqual(salesEmails[0].recipientEmail, ["sales@athletonic.com"]);
  assert.ok(salesEmails[0].proofAttachment.content, "sales email must include proof attachment");
});

test("unit order accepts quantity 1", async () => {
  const sampleProduct = catalogData.products.find((product) => Array.isArray(product.sizes) && product.sizes.length);
  assert.ok(sampleProduct, "expected a product with sizes");
  const { normalizeOrderRequestBody } = require(path.join(__dirname, "..", "api", "_lib", "wholesale-order.js"));
  const productsById = new Map(catalogData.products.map((product) => [String(product.id), product]));
  const normalized = normalizeOrderRequestBody({
    name: "Unit Buyer",
    company_name: "Unit Gym",
    email: "unit@example.com",
    whatsapp: "+1 555 111 2222",
    country: "United States",
    billing: {
      legal_name: "Unit Gym LLC",
      address_line1: "100 Market St",
      city: "Miami",
      country: "United States",
    },
    shipping: {
      address_line1: "200 Gym Ave",
      city: "Miami",
      country: "United States",
    },
    payment_method: "bank_transfer",
    payment_proof: {
      filename: "proof.png",
      mime_type: "image/png",
      data_base64: Buffer.from("fake-image").toString("base64"),
    },
    items: [
      {
        product_id: String(sampleProduct.id),
        quantity: 1,
        selected_options: { Size: sampleProduct.sizes[0] },
      },
    ],
    source_page: "/order",
  }, productsById);
  assert.equal(normalized.quantity_count, 1);
  assert.equal(normalized.items[0].quantity, 1);
});
