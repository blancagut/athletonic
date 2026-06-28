"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const catalogData = require("../data/athletonic-catalog.json");

const PRODUCT_DIR = path.join(__dirname, "..", "product");
const BANNED_COPY_RE = /\bAmazon US\b|\bverified Amazon\b/i;
const SAMPLE_SIZE = 3;

function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(text) {
  return decodeEntities(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatUsdFromCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents) / 100);
}

function readProductHtml(productId) {
  return readFileSync(path.join(PRODUCT_DIR, `${productId}.html`), "utf8");
}

function hasProductHtml(productId) {
  return existsSync(path.join(PRODUCT_DIR, `${productId}.html`));
}

function pickRepresentativeProducts(products) {
  const selected = [];
  const seen = new Set();

  function addMatch(predicate) {
    const match = products.find((product) => {
      const id = String(product.id);
      return !seen.has(id) && predicate(product) && hasProductHtml(id);
    });
    if (!match) return;
    selected.push(match);
    seen.add(String(match.id));
  }

  addMatch(
    (product) =>
      Number(product.price_cents) > 0 &&
      product.available === true &&
      product.requires_variant_selection === true
  );
  addMatch(
    (product) =>
      Number(product.price_cents) > 0 &&
      product.available === true &&
      product.compare_at_price_cents != null
  );
  addMatch((product) => Number(product.price_cents) > 0 && product.available === true);

  for (const product of products) {
    const id = String(product.id);
    if (selected.length >= SAMPLE_SIZE) break;
    if (seen.has(id) || !hasProductHtml(id)) continue;
    if (!(Number(product.price_cents) > 0) || product.available !== true) continue;
    selected.push(product);
    seen.add(id);
  }

  return selected;
}

const sampledProducts = pickRepresentativeProducts(catalogData.products);

assert.ok(
  sampledProducts.length > 0,
  "expected at least one available catalog product with a generated PDP html file"
);

for (const product of sampledProducts) {
  test(`PDP ${product.id} stays consistent with catalog storefront data`, () => {
    const html = readProductHtml(product.id);
    const expectedPrice = formatUsdFromCents(product.price_cents);

    const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    assert.ok(h1Match, `product ${product.id} should render an h1`);
    assert.equal(
      normalizeText(h1Match[1]),
      product.name,
      `product ${product.id} h1 should match catalog name`
    );

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    assert.ok(titleMatch, `product ${product.id} should render a title`);
    assert.ok(
      normalizeText(titleMatch[1]).includes(product.name),
      `product ${product.id} title should include catalog name`
    );

    const priceRowMatch = html.match(
      /<div\b[^>]*data-pdp-price-row\b[^>]*data-base-price-cents="([^"]*)"[^>]*>[\s\S]*?<strong\b[^>]*data-pdp-price\b[^>]*>([^<]+)<\/strong>/i
    );
    assert.ok(priceRowMatch, `product ${product.id} should render a PDP price block`);
    assert.equal(
      Number(priceRowMatch[1]),
      Number(product.price_cents),
      `product ${product.id} price row should carry catalog price_cents`
    );
    assert.equal(
      normalizeText(priceRowMatch[2]),
      expectedPrice,
      `product ${product.id} displayed PDP price should match catalog price_cents`
    );

    assert.doesNotMatch(
      html,
      BANNED_COPY_RE,
      `product ${product.id} should not contain Amazon-facing copy`
    );
  });
}
