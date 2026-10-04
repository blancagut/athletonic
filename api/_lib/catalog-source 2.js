const path = require("node:path");

const FINAL_CATALOG_PATH = path.join(process.cwd(), "data", "final", "catalog.json");
const FINAL_SEARCH_INDEX_PATH = path.join(process.cwd(), "data", "final", "search-index.json");
const FINAL_WHOLESALE_CATALOG_PATH = path.join(
  process.cwd(),
  "data",
  "final",
  "wholesale-catalog.json"
);

const LEGACY_CHECKOUT_CATALOG_PATH = path.join(process.cwd(), "data", "checkout-catalog.json");
const LEGACY_CURATED_CATALOG_PATH = path.join(process.cwd(), "data", "athletonic-catalog.json");
const LEGACY_SEARCH_INDEX_PATH = path.join(process.cwd(), "data", "search-index.json");
const LEGACY_WHOLESALE_MUAY_THAI_PATH = path.join(
  process.cwd(),
  "data",
  "wholesale-muay-thai-catalog.json"
);
const LEGACY_WHOLESALE_SUPPLEMENTS_PATH = path.join(
  process.cwd(),
  "data",
  "wholesale-supplements-catalog.json"
);

function loadWithFallback(primaryPath, fallbackPath) {
  try {
    return require(primaryPath);
  } catch (error) {
    return require(fallbackPath);
  }
}

function loadCatalog() {
  const primary = loadWithFallback(FINAL_CATALOG_PATH, LEGACY_CHECKOUT_CATALOG_PATH);
  const fallback = require(LEGACY_CHECKOUT_CATALOG_PATH);
  const primaryProducts = Array.isArray(primary?.products) ? primary.products : [];
  const fallbackProducts = Array.isArray(fallback?.products) ? fallback.products : [];

  if (!primaryProducts.length || !fallbackProducts.length) return primary;

  const seen = new Set(primaryProducts.map((product) => String(product?.id || "")));
  const extras = fallbackProducts.filter((product) => {
    const id = String(product?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (!extras.length) return primary;
  return {
    ...primary,
    products: [...primaryProducts, ...extras],
  };
}

function loadCuratedCatalog() {
  return loadWithFallback(FINAL_CATALOG_PATH, LEGACY_CURATED_CATALOG_PATH);
}

function loadSearchIndex() {
  return loadWithFallback(FINAL_SEARCH_INDEX_PATH, LEGACY_SEARCH_INDEX_PATH);
}

function loadWholesaleCatalog() {
  return loadWithFallback(FINAL_WHOLESALE_CATALOG_PATH, LEGACY_WHOLESALE_MUAY_THAI_PATH);
}

module.exports = {
  FINAL_CATALOG_PATH,
  FINAL_SEARCH_INDEX_PATH,
  FINAL_WHOLESALE_CATALOG_PATH,
  LEGACY_CHECKOUT_CATALOG_PATH,
  LEGACY_CURATED_CATALOG_PATH,
  LEGACY_SEARCH_INDEX_PATH,
  LEGACY_WHOLESALE_MUAY_THAI_PATH,
  LEGACY_WHOLESALE_SUPPLEMENTS_PATH,
  loadCatalog,
  loadCuratedCatalog,
  loadSearchIndex,
  loadWholesaleCatalog,
};
