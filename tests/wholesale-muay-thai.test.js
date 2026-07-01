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
process.env.ATHLETONIC_SUPPORT_EMAIL = process.env.ATHLETONIC_SUPPORT_EMAIL || "support@example.com";

const APPROVED_WHOLESALE_BRANDS = new Set([
  "boon",
  "century_martial_arts",
  "everlast",
  "fairtex",
  "fuji_sports",
  "hayabusa",
  "raja_boxing",
  "rdx_sports",
  "rival_boxing",
  "sanabul",
  "shock_doctor",
  "topking",
  "twins_special",
  "windy",
]);
const BANNED_WHOLESALE_BRANDS = new Set([
  "bear_komplex",
  "ghost_lifestyle",
  "nike",
  "soccer90",
  "soccer_post",
  "soccer_zone_usa",
  "venum",
]);
const BANNED_WHOLESALE_TERMS =
  /\b(autograph glove|backpack|beanie|duffle|grappling dummy|hanging mirror|hoodie|jacket|jewelry|key\s*chain|key ring|keychain|mini boxing glove|mini gloves|necklace|package protection|personalization|shirt|shoe|supplement|training dummy|venum)\b/i;
const OLD_SHORT_CATEGORIES = new Set(["Muay Thai Shorts", "Boxing Shorts", "Boxing Trunks", "MMA & Fight Shorts"]);

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

function hasOzSize(values, ounces) {
  const pattern = new RegExp(`\\b${ounces}\\s*[- ]?oz\\.?\\b`, "i");
  return values.some((value) => pattern.test(value));
}

test("generated wholesale manifest only contains approved combat brands and no pricing", () => {
  assert.ok(catalogData.products.length >= 2500, "expected a broad combat-sports wholesale catalog");

  for (const product of catalogData.products) {
    assert.ok(
      APPROVED_WHOLESALE_BRANDS.has(product.brand_slug),
      `unexpected wholesale brand ${product.brand_slug} for ${product.name}`
    );
    assert.ok(
      !BANNED_WHOLESALE_BRANDS.has(product.brand_slug),
      `banned wholesale brand ${product.brand_slug} leaked into catalog`
    );
    assert.ok(
      !BANNED_WHOLESALE_TERMS.test([product.name, product.url, product.category_label, product.product_type].join(" ")),
      `non-fight wholesale product leaked into catalog: ${product.brand} ${product.name}`
    );
    assert.ok(!("price" in product));
    assert.ok(!("price_cents" in product));
    assert.ok(!("cost" in product));
    assert.ok(!("margin" in product));
    assert.ok(!("supplier_price" in product));
  }

  for (const requiredBrand of APPROVED_WHOLESALE_BRANDS) {
    assert.ok(
      catalogData.products.some((product) => product.brand_slug === requiredBrand),
      `expected ${requiredBrand} products in wholesale catalog`
    );
  }

  for (const requiredCategory of [
    "Shorts",
    "Training Gloves",
    "Bag Gloves",
    "Shin Guards",
    "Headgear",
    "Focus Mitts",
    "Thai Pads & Kick Pads",
    "Heavy Bags",
    "Hand Wraps & Tape",
    "Groin Protectors",
    "Mouthguards",
  ]) {
    assert.ok(
      catalogData.products.some((product) => product.category_label === requiredCategory),
      `expected ${requiredCategory} category in wholesale catalog`
    );
  }

  assert.equal(
    catalogData.products.filter((product) => OLD_SHORT_CATEGORIES.has(product.category_label)).length,
    0,
    "shorts should be grouped into the single Shorts category"
  );
  assert.ok(
    catalogData.products.some(
      (product) => product.brand_slug === "fairtex" && product.category_label === "Shorts" && /boxing shorts?/i.test(product.name)
    ),
    "expected Fairtex boxing shorts under Shorts"
  );
  assert.equal(
    catalogData.products.filter(
      (product) => product.category_label === "Bag Gloves" && !/\b(bag gloves?|bag mitts?)\b/i.test(product.name)
    ).length,
    0,
    "Bag Gloves should not include generic training gloves"
  );
});

test("Thai adult glove ounce runs include 16oz without inventing S/M/L bag glove sizes", () => {
  const coreThaiBrands = new Set(["boon", "topking", "twins_special"]);
  const childPattern = /\b(kids?|children|youth|mini|key ring|keychain|hanging mirror)\b/i;
  const productText = (product) => [product.name, product.category_label, product.product_type].join(" ");

  const adultOzRunsMissing16 = catalogData.products.filter((product) => {
    if (!coreThaiBrands.has(product.brand_slug)) return false;
    if (!/Training Gloves|Lace-Up & Fight Gloves|Bag Gloves/i.test(product.category_label)) return false;
    if (childPattern.test(productText(product))) return false;
    const hasAdultOzRun = [8, 10, 12, 14].every((ounces) => hasOzSize(product.sizes, ounces));
    return hasAdultOzRun && !hasOzSize(product.sizes, 16);
  });

  assert.deepEqual(
    adultOzRunsMissing16.map((product) => `${product.brand}: ${product.name}`),
    [],
    "adult Thai glove lines that offer 8/10/12/14oz should also expose 16oz"
  );

  const boonCompactGlove = catalogData.products.find(
    (product) => product.brand_slug === "boon" && /Compact Velcro Glove Burgundy/i.test(product.name)
  );
  assert.ok(boonCompactGlove, "expected Boon Compact Velcro Glove in wholesale catalog");
  assert.ok(hasOzSize(boonCompactGlove.sizes, 16), "expected Boon glove to include 16oz");

  const topKingProGlove = catalogData.products.find(
    (product) => product.brand_slug === "topking" && /TOPKING GLOVES "PRO"/i.test(product.name)
  );
  assert.ok(topKingProGlove, "expected Top King PRO glove in wholesale catalog");
  assert.ok(hasOzSize(topKingProGlove.sizes, 16), "expected Top King glove to include 16oz");

  const twinsGlove = catalogData.products.find(
    (product) => product.brand_slug === "twins_special" && /TWINS Boxing Gloves/i.test(product.name)
  );
  assert.ok(twinsGlove, "expected Twins Special glove in wholesale catalog");
  assert.ok(hasOzSize(twinsGlove.sizes, 16), "expected Twins Special glove to include 16oz");

  const boonBagGlove = catalogData.products.find(
    (product) => product.brand_slug === "boon" && product.category_label === "Bag Gloves" && /^BGBK Bag Gloves/i.test(product.name)
  );
  assert.ok(boonBagGlove, "expected Boon S/M/L bag glove in wholesale catalog");
  assert.deepEqual(boonBagGlove.sizes, ["S", "M", "L", "XL"], "bag gloves with apparel-style sizes should stay S/M/L/XL");

  const boonChildFourOzGloves = catalogData.products.filter(
    (product) => product.brand_slug === "boon" && /\b4oz Children's Gloves\b/i.test(product.name)
  );
  assert.ok(boonChildFourOzGloves.length > 0, "expected Boon 4oz children's gloves in wholesale catalog");
  for (const product of boonChildFourOzGloves) {
    assert.deepEqual(product.sizes, ["4oz"], `${product.name} should expose only the explicit 4oz size`);
  }
});

test("wholesale line sheet header stays lean and does not show counts or badges", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "pages", "catalog", "wholesale-muay-thai.html"), "utf8");

  assert.ok(!html.includes("Quote only"));
  assert.ok(!html.includes("No prices shown"));
  assert.ok(!html.includes("Mobile ready"));
  assert.ok(!html.includes("data-result-count"));
  assert.ok(!html.includes("catalog lines"));
});

test("GET /api/wholesale/catalog returns retail + wholesale pricing (40% off)", async () => {
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
  assert.ok(Number.isInteger(payload.products[0].retail_price_cents) && payload.products[0].retail_price_cents > 0);
  assert.equal(
    payload.products[0].wholesale_price_cents,
    Math.max(1, Math.round(payload.products[0].retail_price_cents * 0.6)),
    "wholesale price must be retail minus 40%"
  );
  assert.equal(payload.products[0].wholesale_discount_bps, 4000);
  assert.ok(Array.isArray(payload.facets.brands));
  assert.ok(Array.isArray(payload.facets.categories));
});

test("THB-sourced brands (raja_boxing) stay quote-only with no invented USD price", async () => {
  const handler = require("../api/wholesale/catalog.js");
  const req = {
    method: "GET",
    url: "/api/wholesale/catalog?brand=raja_boxing&page_size=5",
    query: { brand: "raja_boxing", page_size: "5" },
    headers: {},
  };
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.ok(payload.products.length > 0);
  for (const product of payload.products) {
    assert.equal(product.retail_price_cents, null);
    assert.equal(product.wholesale_price_cents, null);
  }
});

test("GET /api/wholesale/catalog supports unified Shorts category search", async () => {
  const handler = require("../api/wholesale/catalog.js");
  const req = {
    method: "GET",
    url: "/api/wholesale/catalog?brand=fairtex&category=Shorts&search=fairtex%20boxing%20shorts&page_size=10",
    query: { brand: "fairtex", category: "Shorts", search: "fairtex boxing shorts", page_size: "10" },
    headers: {},
  };
  const res = createResponseCapture();

  await handler(req, res);

  const payload = readJsonResponse(res);
  assert.equal(res.statusCode, 200);
  assert.ok(payload.filtered_count > 0, "expected Fairtex boxing shorts to be searchable in Shorts");
  for (const product of payload.products) {
    assert.equal(product.brand_slug, "fairtex");
    assert.equal(product.category_label, "Shorts");
    assert.match(product.name, /boxing shorts?/i);
  }
});

test("POST /api/wholesale/quote-requests stores sanitized items and notifies admins", async () => {
  const sampleProduct = catalogData.products.find(
    (product) => Array.isArray(product.sizes) && product.sizes.length > 0
  );
  assert.ok(sampleProduct, "expected a product with sizes for quote request tests");

  const inserts = [];
  const notifications = [];
  const buyerEmails = [];
  const handler = withMockedModules(path.join(__dirname, "..", "api", "wholesale", "quote-requests.js"), {
    [path.join(__dirname, "..", "api", "_lib", "supabase.js")]: {
      getSupabaseAdmin: () => ({
        from(table) {
          if (table === "profiles") {
            return {
              select() {
                return {
                  eq() {
                    return Promise.resolve({
                      data: [{ email: "owner@example.com" }, { email: "support@example.com" }],
                      error: null,
                    });
                  },
                };
              },
            };
          }
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
      sendWholesaleQuoteBuyerEmail: async (payload) => {
        buyerEmails.push(payload);
        return { id: "email-2" };
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
  assert.equal(payload.buyer_confirmation_sent, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].item_count, 1);
  assert.equal(inserts[0].quantity_count, 3);
  assert.equal(inserts[0].items[0].product_id, String(sampleProduct.id));
  assert.equal(inserts[0].items[0].quantity, 3);
  assert.equal(inserts[0].items[0].retail_price_cents, sampleProduct.retail_price_cents || null);
  assert.equal(
    inserts[0].items[0].wholesale_price_cents,
    sampleProduct.retail_price_cents ? Math.max(1, Math.round(sampleProduct.retail_price_cents * 0.6)) : null,
    "stored quote item must snapshot the 40%-off wholesale price"
  );
  assert.equal(inserts[0].items[0].wholesale_discount_bps, 4000);
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].recipientEmail, ["owner@example.com", "support@example.com"]);
  assert.ok(notifications[0].quotePdf && Buffer.isBuffer(notifications[0].quotePdf.buffer), "admin email must carry the PDF");
  assert.equal(buyerEmails.length, 1);
  assert.equal(buyerEmails[0].request.email, "alex@example.com");
  assert.ok(buyerEmails[0].quotePdf, "buyer email must carry the quotation PDF");
  assert.ok(Buffer.isBuffer(buyerEmails[0].quotePdf.buffer), "quotation PDF must be a buffer");
  assert.equal(buyerEmails[0].quotePdf.buffer.subarray(0, 5).toString(), "%PDF-", "attachment must be a valid PDF");
  assert.match(buyerEmails[0].quotePdf.filename, /^Athletonic-Quotation-AW-[0-9A-Z]+\.pdf$/);
});
