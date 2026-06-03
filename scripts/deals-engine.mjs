#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CATALOG_PATH = new URL("../data/athletonic-catalog.json", import.meta.url);
const STATE_PATH = new URL("../data/deals-state.json", import.meta.url);
const DATA_DIR = new URL("../data/", import.meta.url);

const DEFAULT_DURATION_DAYS = 10;
const DEFAULT_LIMIT = 18;
const SOURCE_LABEL = "Google News RSS + Athletonic catalog matching";

const TREND_QUERIES = [
  {
    label: "fitness supplements",
    query: "fitness supplements when:7d",
    sectionIds: ["protein", "creatine", "pre-workout", "hydration", "vitamins", "greens"],
    terms: ["supplement", "protein", "creatine", "pre workout", "electrolyte", "vitamin"],
  },
  {
    label: "protein powder",
    query: "protein powder when:7d",
    sectionIds: ["protein", "bars-shakes"],
    terms: ["protein", "whey", "isolate", "shake", "bar"],
  },
  {
    label: "creatine",
    query: "creatine supplement when:7d",
    sectionIds: ["creatine"],
    terms: ["creatine", "strength", "muscle"],
  },
  {
    label: "pre workout",
    query: "pre workout supplement when:7d",
    sectionIds: ["pre-workout"],
    terms: ["pre workout", "pre-workout", "pump", "focus", "caffeine"],
  },
  {
    label: "hydration",
    query: "hydration electrolytes when:7d",
    sectionIds: ["hydration"],
    terms: ["hydration", "electrolyte", "sodium", "drink mix"],
  },
  {
    label: "recovery tools",
    query: "fitness recovery tools when:7d",
    sectionIds: ["recovery", "sleep", "cold-therapy", "massage-mobility", "compression"],
    terms: ["recovery", "massage", "compression", "sleep", "mobility"],
  },
  {
    label: "running shoes",
    query: "running shoes fitness when:7d",
    sectionIds: ["shoes", "footwear"],
    terms: ["running", "shoe", "trainer", "footwear"],
  },
  {
    label: "gym gear",
    query: "gym gear when:7d",
    sectionIds: ["accessories", "training-gear", "lifting-gear", "apparel"],
    terms: ["gym", "lifting", "belt", "strap", "bag", "apparel"],
  },
];

function numberFlag(name, fallback) {
  const exact = process.argv.indexOf(name);
  if (exact >= 0 && process.argv[exact + 1]) {
    const value = Number(process.argv[exact + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    const value = Number(inline.slice(name.length + 1));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  return fallback;
}

function readJson(url, fallback) {
  if (!existsSync(url)) return fallback;
  try {
    return JSON.parse(readFileSync(url, "utf8")) ?? fallback;
  } catch {
    return fallback;
  }
}

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripTags(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tagText(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function parseRssItems(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map((block) => {
      const published = tagText(block, "pubDate");
      const date = Date.parse(published);
      return {
        title: tagText(block, "title"),
        source: tagText(block, "source") || "Google News",
        url: tagText(block, "link"),
        published_at: Number.isFinite(date) ? new Date(date).toISOString() : null,
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchTrendFeed(config) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", config.query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AthletonicDealsEngine/1.0" },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    return parseRssItems(xml).slice(0, 8);
  } finally {
    clearTimeout(timeout);
  }
}

function hashString(value) {
  let hash = 5381;
  for (const char of String(value)) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return Math.abs(hash >>> 0);
}

function basePriceCents(product) {
  const compareAt = Number(product.compare_at_price_cents || 0);
  const price = Number(product.price_cents || 0);
  if (Number.isFinite(compareAt) && compareAt > 0) return compareAt;
  return Number.isFinite(price) ? price : 0;
}

function productText(product) {
  return [
    product.brand,
    product.name,
    product.section_id,
    product.section_title,
    product.sku,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[-_]+/g, " ");
}

function scoreProduct(product, signals) {
  const text = productText(product);
  let score = 0;
  const terms = new Set();
  const matchedSignals = [];

  for (const signal of signals) {
    if (!signal.items.length) continue;
    let signalScore = 0;
    if (signal.sectionIds.includes(product.section_id)) {
      signalScore += 8 + Math.min(6, signal.items.length);
    }
    for (const term of signal.terms) {
      const normalized = term.toLowerCase().replace(/[-_]+/g, " ");
      if (text.includes(normalized)) {
        signalScore += 5;
        terms.add(term);
      }
    }
    const titleHits = signal.items.filter((item) => {
      const title = item.title.toLowerCase();
      return signal.terms.some((term) => title.includes(term.toLowerCase()));
    }).length;
    signalScore += Math.min(4, titleHits);
    if (signalScore > 0) {
      score += signalScore;
      matchedSignals.push(signal);
    }
  }

  return { score, terms: [...terms], matchedSignals };
}

function discountFor(product, score, generatedAt) {
  const cents = basePriceCents(product);
  const seed = hashString(`${generatedAt}:${product.id}:${score}`);
  let options = [8, 10];

  if (cents >= 2500) options = [8, 10, 12];
  if (cents >= 5000) options = [10, 12, 15];
  if (cents >= 10000) options = [12, 15, 18];
  if (score >= 28 && cents >= 5000) options = [...options, 20];

  return options[seed % options.length];
}

function salePriceCents(originalPriceCents, discountPercent) {
  const sale = Math.round(originalPriceCents * (100 - discountPercent) / 100);
  return Math.max(499, sale);
}

function compactSources(product, matchedSignals) {
  const text = productText(product);
  const out = [];
  const seen = new Set();

  for (const signal of matchedSignals) {
    const ranked = signal.items.filter((item) => {
      const title = item.title.toLowerCase();
      return signal.terms.some((term) => {
        const normalized = term.toLowerCase().replace(/[-_]+/g, " ");
        return text.includes(normalized) || title.includes(normalized);
      });
    });
    for (const item of (ranked.length ? ranked : signal.items).slice(0, 2)) {
      const key = `${item.title}:${item.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 3) return out;
    }
  }

  return out;
}

function normalizeExistingOffer(offer, product) {
  const originalPriceCents = Number(offer.original_price_cents || basePriceCents(product));
  const discountPercent = Number(offer.discount_percent || 0);
  const sale = Number(offer.sale_price_cents || salePriceCents(originalPriceCents, discountPercent));
  return {
    ...offer,
    product_id: String(product.id),
    brand: product.brand,
    name: product.name,
    section_id: product.section_id,
    section_title: product.section_title,
    original_price_cents: originalPriceCents,
    sale_price_cents: sale,
    discount_percent: discountPercent,
    reason: offer.reason || "Limited-time Athletonic offer",
    trend_terms: Array.isArray(offer.trend_terms) ? offer.trend_terms : [],
    sources: Array.isArray(offer.sources) ? offer.sources : [],
  };
}

function buildOffer({ product, generatedAt, expiresAt, score, terms, matchedSignals }) {
  const originalPriceCents = basePriceCents(product);
  const discountPercent = discountFor(product, score, generatedAt);
  const signalLabels = matchedSignals.slice(0, 2).map((signal) => signal.label);

  return {
    product_id: String(product.id),
    brand: product.brand,
    name: product.name,
    section_id: product.section_id,
    section_title: product.section_title,
    original_price_cents: originalPriceCents,
    sale_price_cents: salePriceCents(originalPriceCents, discountPercent),
    discount_percent: discountPercent,
    starts_at: generatedAt,
    expires_at: expiresAt,
    reason: `Trend signal: ${signalLabels.join(", ")}`,
    trend_terms: terms.slice(0, 8),
    sources: compactSources(product, matchedSignals),
  };
}

async function main() {
  const durationDays = Math.round(numberFlag("--duration-days", DEFAULT_DURATION_DAYS));
  const limit = Math.round(numberFlag("--limit", DEFAULT_LIMIT));
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const catalog = readJson(CATALOG_PATH, null);
  if (!catalog || !Array.isArray(catalog.products)) {
    throw new Error("Missing data/athletonic-catalog.json. Run npm run generate first.");
  }

  const products = catalog.products.filter(
    (product) => product.available !== false && basePriceCents(product) >= 1000
  );
  const productById = new Map(products.map((product) => [String(product.id), product]));

  const existing = readJson(STATE_PATH, { offers: [] });
  const now = Date.now();
  const activeExisting = (Array.isArray(existing.offers) ? existing.offers : [])
    .filter((offer) => {
      const expires = Date.parse(offer.expires_at || "");
      return offer.product_id != null && Number.isFinite(expires) && expires > now;
    })
    .map((offer) => {
      const product = productById.get(String(offer.product_id));
      return product ? normalizeExistingOffer(offer, product) : null;
    })
    .filter(Boolean)
    .slice(0, limit);

  const activeIds = new Set(activeExisting.map((offer) => String(offer.product_id)));
  const expiredOfferIds = (Array.isArray(existing.offers) ? existing.offers : [])
    .filter((offer) => {
      const expires = Date.parse(offer.expires_at || "");
      return !Number.isFinite(expires) || expires <= now || !productById.has(String(offer.product_id));
    })
    .map((offer) => String(offer.product_id));

  const signals = await Promise.all(
    TREND_QUERIES.map(async (config) => {
      try {
        return { ...config, items: await fetchTrendFeed(config) };
      } catch (error) {
        return { ...config, items: [], error: String(error.message || error) };
      }
    })
  );

  const candidates = products
    .filter((product) => !activeIds.has(String(product.id)))
    .map((product) => ({ product, ...scoreProduct(product, signals) }))
    .filter((candidate) => candidate.score > 0 && candidate.matchedSignals.length > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return hashString(a.product.id) - hashString(b.product.id);
    });

  const remaining = Math.max(0, limit - activeExisting.length);
  const newOffers = candidates
    .slice(0, remaining)
    .map((candidate) => buildOffer({ ...candidate, generatedAt, expiresAt }));

  const state = {
    generated_at: generatedAt,
    duration_days: durationDays,
    source: SOURCE_LABEL,
    trend_queries: signals.map((signal) => ({
      label: signal.label,
      query: signal.query,
      item_count: signal.items.length,
      error: signal.error || null,
    })),
    offers: [...activeExisting, ...newOffers],
    expired_offer_ids: expiredOfferIds,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);

  const failedFeeds = signals.filter((signal) => signal.error).length;
  console.log(
    `Generated ${state.offers.length} active offers (${newOffers.length} new, ${activeExisting.length} kept) for ${durationDays} days.`
  );
  console.log(`Trend feeds checked: ${signals.length - failedFeeds}/${signals.length}.`);
  if (failedFeeds) {
    console.log(`${failedFeeds} feeds failed; existing active offers were preserved where possible.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
