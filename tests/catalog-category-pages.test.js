"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const catalog = require("../data/final/catalog.published.json");
const byId = new Map(catalog.products.map((product) => [String(product.id), product]));
const categorySlugs = [
  "boxing-gloves", "top-king", "boon", "top-king-boon", "muay-thai-shorts",
  "shin-guards", "pads-punch-mitts", "heavy-bags", "gym-equipment",
  "fight-clothing", "brands", "training-apparel",
];

function page(slug) {
  return fs.readFileSync(path.join(ROOT, "pages", `${slug}.html`), "utf8");
}

function productIds(html) {
  return [...html.matchAll(/class="product-card"[^>]*data-product-id="([^"]+)"/g)].map((match) => match[1]);
}

function sectionHtml(html, anchor) {
  const start = html.indexOf(`id="${anchor}"`);
  assert.ok(start >= 0, `missing #${anchor}`);
  return html.slice(start, html.indexOf("</section>", start));
}

test("category pages expose the complete collection through organized Load more sections", () => {
  const generator = fs.readFileSync(path.join(ROOT, "scripts/generate-home.mjs"), "utf8");
  assert.doesNotMatch(generator, /\.slice\(0,\s*shelf\.limit/);
  assert.match(generator, /data-listing-load-more/);
  assert.match(generator, /var cards = Array\.from\(document\.querySelectorAll\("\.listing-sections \.product-card"\)\)/);

  for (const slug of categorySlugs) {
    const html = page(slug);
    const ids = productIds(html);
    assert.ok(ids.length > 0, `${slug} should contain products`);
    assert.match(html, /data-listing-filter/);
    assert.match(html, /data-listing-count/);
    assert.match(html, /class="listing-quick-links"/);
    assert.match(html, /data-listing-index="24" hidden/, `${slug} should paginate after its first 24-card section when applicable`);
    assert.equal(new Set(ids).size, ids.length, `${slug} should not repeat products across sections`);
  }

  assert.ok(new Set(productIds(page("top-king"))).size > 48);
  assert.ok(new Set(productIds(page("boon"))).size > 48);
  assert.ok(new Set(productIds(page("training-apparel"))).size > 48);
});

test("all collection product links are canonical internal PDP links", () => {
  for (const slug of categorySlugs) {
    const html = page(slug);
    const hrefs = [...html.matchAll(/class="product-card-link" href="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(hrefs.length > 0, `${slug} should have product links`);
    for (const href of hrefs) {
      assert.match(href, /^\.\.\/product\/[A-Za-z0-9_-]+\.html$/);
      assert.ok(fs.existsSync(path.join(ROOT, href.replace(/^\.\.\//, ""))), `${slug}: ${href} should exist`);
    }
  }
});

test("Top King Shorts contains only strictly classified authentic fight shorts", async () => {
  const { isAuthenticFightShorts } = await import("../scripts/lib/catalog-classifiers.mjs");
  const ids = productIds(sectionHtml(page("muay-thai-shorts"), "top-king-shorts"));
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const product = byId.get(id);
    assert.ok(product, `Top King Shorts product ${id} should be canonical`);
    assert.equal(product.brand_slug, "topking", `${id} should be Top King`);
    assert.equal(isAuthenticFightShorts(product), true, `${id}: ${product.name}`);
  }
});

test("Nike apparel is inside Clothing and footwear is excluded", async () => {
  const { isNikeApparel } = await import("../scripts/lib/catalog-classifiers.mjs");
  const ids = productIds(sectionHtml(page("fight-clothing"), "nike-apparel"));
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const product = byId.get(id);
    assert.ok(product, `Nike product ${id} should be canonical`);
    assert.equal(isNikeApparel(product), true, `${id}: ${product.name}`);
  }
});

test("Footwear is absent from navigation and its compatibility URL redirects to Clothing", () => {
  const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.doesNotMatch(home, /Nike &amp; Footwear|pages\/footwear\.html/);
  assert.match(home, /fight-clothing\.html#nike-apparel/);

  const footwear = page("footwear");
  assert.match(footwear, /window\.location\.replace\("\/pages\/fight-clothing\.html"\)/);
  assert.match(footwear, /Continue to Clothing/);
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(vercel.redirects.some((redirect) => redirect.source === "/pages/footwear.html" && redirect.destination === "/pages/fight-clothing.html"));
});

test("collection navigation has no empty in-page destination", () => {
  for (const slug of categorySlugs) {
    const html = page(slug);
    const anchors = [...html.matchAll(/class="listing-quick-links"[\s\S]*?<\/nav>/g)]
      .flatMap((nav) => [...nav[0].matchAll(/href="#([^"]+)"/g)].map((match) => match[1]));
    for (const anchor of anchors) {
      const section = sectionHtml(html, anchor);
      assert.ok(productIds(section).length > 0, `${slug}#${anchor} should contain products`);
    }
  }
});

test("removed decorative products stay absent from published and generated catalog surfaces", () => {
  const files = [
    "data/final/catalog.published.json", "data/final/search-index.published.json",
    "data/search-index.json", ...categorySlugs.map((slug) => `pages/${slug}.html`),
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /hanging mirror boxing gloves|rear view mirror heavy bag/i, file);
  }
});

test("YOKKAO is temporarily hidden from visible category and brand pages", () => {
  for (const slug of categorySlugs) {
    assert.doesNotMatch(page(slug), /\bYOKKAO\b|data-search="[^"]*yokkao/i, slug);
  }
  const cartSource = fs.readFileSync(path.join(ROOT, "assets/cart.js"), "utf8");
  assert.match(cartSource, /brand === "yokkao"/);
});
