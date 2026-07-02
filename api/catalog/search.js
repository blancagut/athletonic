// GET /api/catalog/search?q=<query>&category=<section_id|all>&limit=<n>
//
// Server-side product search over the generated search index. The dropdown
// live-search calls this endpoint first so casual shoppers never download the
// multi-MB data/search-index.json; the client falls back to the local index
// when this endpoint is unavailable (e.g. plain static dev servers).
//
// Matching semantics mirror assets/cart.js (live-search IIFE): normalized
// substring match, squashed compound-word match ("shinguards" <-> "shin
// guards"), singular/plural token variants, and a partial-match fallback with
// one-edit typo tolerance so queries never dead-end.
const { handleError, json, methodNotAllowed } = require("../_lib/http");

let searchIndex;
try {
  searchIndex = require("../../data/search-index.json");
} catch (error) {
  searchIndex = { products: [] };
}
const PRODUCTS = Array.isArray(searchIndex.products) ? searchIndex.products : [];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const FALLBACK_MAX_RESULTS = 400;

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTokens(normalizedQuery) {
  const seen = new Set();
  return normalizedQuery
    .split(/\s+/)
    .filter((token) => token && (token.length > 1 || /\d/.test(token)))
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

const blobCache = new WeakMap();
function productBlobs(product) {
  let blobs = blobCache.get(product);
  if (!blobs) {
    const text = normalizeSearchText(
      product.search ||
        [product.name, product.brand, product.brand_slug, product.section_id]
          .filter(Boolean)
          .join(" ")
    );
    blobs = { text, squashed: text.replace(/ /g, ""), words: null };
    blobCache.set(product, blobs);
  }
  return blobs;
}

function tokenVariants(token) {
  const variants = [token];
  if (token.length > 3 && token.endsWith("s")) variants.push(token.slice(0, -1));
  return variants;
}

function tokenInBlobs(blobs, token) {
  return tokenVariants(token).some(
    (variant) => blobs.text.includes(variant) || blobs.squashed.includes(variant)
  );
}

function tokenAlmostMatchesWord(token, word) {
  const tl = token.length;
  const wl = word.length;
  if (Math.abs(tl - wl) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < tl && j < wl) {
    if (token[i] === word[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (tl === wl && i + 1 < tl && j + 1 < wl && token[i] === word[j + 1] && token[i + 1] === word[j]) {
      i += 2;
      j += 2;
    } else if (tl > wl) i += 1;
    else if (wl > tl) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (tl - i) + (wl - j) <= 1;
}

function fuzzyTokenInBlobs(blobs, token) {
  if (token.length < 5) return false;
  if (!blobs.words) blobs.words = blobs.text.split(" ");
  return blobs.words.some((word) => tokenAlmostMatchesWord(token, word));
}

function matchesQuery(blobs, normalizedQuery, tokens) {
  if (blobs.text.includes(normalizedQuery)) return true;
  const squashedQuery = normalizedQuery.replace(/ /g, "");
  if (squashedQuery && blobs.squashed.includes(squashedQuery)) return true;
  return tokens.length > 0 && tokens.every((token) => tokenInBlobs(blobs, token));
}

function scoreProduct(product, blobs, normalizedQuery, tokens) {
  const name = normalizeSearchText(product.name);
  const brand = normalizeSearchText(product.brand || product.brand_slug);
  let score = 0;
  if (name === normalizedQuery) score += 120;
  else if (name.startsWith(normalizedQuery)) score += 80;
  else if (name.includes(normalizedQuery)) score += 50;
  if (brand && (brand === normalizedQuery || normalizedQuery.includes(brand))) score += 40;
  for (const token of tokens) {
    if (name.includes(token)) score += 12;
    else if (brand && brand.includes(token)) score += 8;
    else if (tokenInBlobs(blobs, token)) score += 4;
  }
  return score;
}

function search(query, category, limit) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = queryTokens(normalizedQuery);
  const inCategory = (product) =>
    !category || category === "all" || product.section_id === category;
  const priced = (product) => Number(product.price_cents || 0) > 0;

  const base = [];
  for (const product of PRODUCTS) {
    if (priced(product) && inCategory(product)) base.push(product);
  }
  if (!normalizedQuery) {
    return { total: base.length, products: base.slice(0, limit) };
  }

  let matches = [];
  for (const product of base) {
    const blobs = productBlobs(product);
    if (matchesQuery(blobs, normalizedQuery, tokens)) {
      matches.push({ product, score: scoreProduct(product, blobs, normalizedQuery, tokens) });
    }
  }

  if (!matches.length && tokens.length) {
    // Partial-match fallback: rank by number of tokens matched (with typo
    // tolerance) so the shopper always sees the closest inventory.
    for (const product of base) {
      const blobs = productBlobs(product);
      let hits = 0;
      for (const token of tokens) {
        if (tokenInBlobs(blobs, token) || fuzzyTokenInBlobs(blobs, token)) hits += 1;
      }
      if (hits > 0) {
        matches.push({
          product,
          score: hits * 1000 + scoreProduct(product, blobs, normalizedQuery, tokens),
        });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    matches = matches.slice(0, FALLBACK_MAX_RESULTS);
  } else {
    matches.sort((a, b) => b.score - a.score);
  }

  return {
    total: matches.length,
    products: matches.slice(0, limit).map((entry) => entry.product),
  };
}

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  try {
    const params =
      req.query && typeof req.query === "object"
        ? req.query
        : Object.fromEntries(new URL(req.url, "http://localhost").searchParams);
    const query = String(params.q || "").slice(0, 120);
    const category = String(params.category || "all").slice(0, 40);
    const limitRaw = Number.parseInt(params.limit, 10);
    const limit = Number.isInteger(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const result = search(query, category, limit);
    // Popular queries repeat constantly: cache per-URL on the CDN for an hour.
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    json(res, 200, {
      query,
      category,
      total: result.total,
      products: result.products,
    });
  } catch (error) {
    handleError(res, error);
  }
};
