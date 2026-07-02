#!/usr/bin/env node
// Scrape official Shopify catalogs for YOKKAO and Primo into the same JSON
// shape as data/boon-products.json (USD storefronts, verified via Shopify.currency).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const SOURCES = {
  yokkao: {
    base: "https://yokkao.com",
    brand: "YOKKAO",
    output: path.join(ROOT, "data", "yokkao-products.json"),
  },
  primo: {
    base: "https://www.primofightwear.com",
    brand: "Primo",
    output: path.join(ROOT, "data", "primo-products.json"),
  },
};

const SIZE_NAME_RE = /size|weight|oz/i;
const COLOR_NAME_RE = /colou?r/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
      if (res.status === 429) {
        await sleep(8000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === 4) throw new Error(`Failed to fetch ${url}: ${error.message}`);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Never link back to the official brand stores: unwrap all anchors in
// descriptions (keep the inner text, drop the href) and remove any
// plain-text mentions of the official domains.
function stripAnchors(html) {
  return String(html || "")
    .replace(/<a\b[^>]*>/gi, "")
    .replace(/<\/a>/gi, "")
    .replace(/\S*(yokkao\.com|primofightwear\.com)\S*/gi, "")
    .replace(/  +/g, " ");
}

function mapProduct(source, product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const options = Array.isArray(product.options) ? product.options : [];
  const images = Array.isArray(product.images)
    ? product.images.map((image) => String(image.src || "").trim()).filter(Boolean)
    : [];

  const prices = variants.map((variant) => toNumber(variant.price)).filter((value) => value !== null);
  const price = prices.length ? Math.min(...prices) : null;

  const sizes = [];
  const colors = [];
  for (const option of options) {
    const values = Array.isArray(option.values)
      ? [...new Set(option.values.map((value) => String(value || "").trim()).filter(Boolean))]
      : [];
    if (!values.length || (values.length === 1 && /^default title$/i.test(values[0]))) continue;
    if (SIZE_NAME_RE.test(String(option.name || ""))) sizes.push(...values);
    else if (COLOR_NAME_RE.test(String(option.name || ""))) colors.push(...values);
  }

  const variantTitles = [
    ...new Set(
      variants
        .map((variant) => String(variant.title || "").trim())
        .filter((title) => title && !/^default title$/i.test(title))
    ),
  ];

  const tags = Array.isArray(product.tags)
    ? product.tags
    : String(product.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  const category = [String(product.product_type || "").trim(), ...tags].filter(Boolean).join(" | ") || null;

  const anyAvailable = variants.some((variant) => variant.available !== false);

  return {
    brand: source.brand,
    category,
    product_name: String(product.title || "").trim(),
    sku: String(variants[0]?.sku || product.handle || "").trim() || null,
    product_url: `${source.base}/products/${product.handle}`,
    short_description: null,
    full_description: stripAnchors(String(product.body_html || "").trim()) || null,
    price,
    currency: "USD",
    available_sizes: [...new Set(sizes)],
    available_colors: [...new Set(colors)],
    available_variants: variantTitles,
    material: null,
    weight: null,
    country_of_origin: null,
    stock_status: anyAvailable ? "in stock" : "out of stock",
    images,
  };
}

async function scrape(slug) {
  const source = SOURCES[slug];
  const products = [];
  for (let page = 1; page <= 40; page += 1) {
    const data = await fetchJson(`${source.base}/products.json?limit=250&page=${page}`);
    const batch = Array.isArray(data?.products) ? data.products : [];
    if (!batch.length) break;
    for (const product of batch) {
      if (!product?.handle || !product?.title) continue;
      products.push(mapProduct(source, product));
    }
    await sleep(400);
  }

  const withImages = products.filter((product) => product.images.length);
  fs.writeFileSync(source.output, `${JSON.stringify(withImages, null, 1)}\n`);
  const priced = withImages.filter((product) => product.price !== null).length;
  console.log(`${source.brand}: wrote ${withImages.length} products (${priced} priced) to ${path.relative(ROOT, source.output)}`);
}

const requested = process.argv.slice(2).filter((slug) => SOURCES[slug]);
const slugs = requested.length ? requested : Object.keys(SOURCES);
for (const slug of slugs) {
  await scrape(slug);
}
