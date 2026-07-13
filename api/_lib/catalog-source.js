const path = require("node:path");

const FINAL_CATALOG_PATH = path.join(__dirname, "../../data", "final", "catalog.json");
const FINAL_PUBLISHED_CATALOG_PATH = path.join(
  __dirname,
  "../../data",
  "final",
  "catalog.published.json"
);
const FINAL_SEARCH_INDEX_PATH = path.join(__dirname, "../../data", "final", "search-index.json");
const FINAL_PUBLISHED_SEARCH_INDEX_PATH = path.join(
  __dirname,
  "../../data",
  "final",
  "search-index.published.json"
);
const FINAL_WHOLESALE_CATALOG_PATH = path.join(
  __dirname,
  "../../data",
  "final",
  "wholesale-catalog.json"
);
const FINAL_PUBLISHED_WHOLESALE_CATALOG_PATH = path.join(
  __dirname,
  "../../data",
  "final",
  "wholesale-catalog.published.json"
);

const LEGACY_CHECKOUT_CATALOG_PATH = path.join(__dirname, "../../data", "checkout-catalog.json");
const LEGACY_CURATED_CATALOG_PATH = path.join(__dirname, "../../data", "athletonic-catalog.json");
const LEGACY_SEARCH_INDEX_PATH = path.join(__dirname, "../../data", "search-index.json");
const LEGACY_WHOLESALE_MUAY_THAI_PATH = path.join(
  __dirname,
  "../../data",
  "wholesale-muay-thai-catalog.json"
);
const LEGACY_WHOLESALE_SUPPLEMENTS_PATH = path.join(
  __dirname,
  "../../data",
  "wholesale-supplements-catalog.json"
);

function loadWithFallback(primaryPath, fallbackPath) {
  try {
    return require(primaryPath);
  } catch (error) {
    return require(fallbackPath);
  }
}

function mergeLegacyCheckoutExtras(primary) {
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

function loadPublishedCatalog() {
  return loadWithFallback(FINAL_PUBLISHED_CATALOG_PATH, LEGACY_CHECKOUT_CATALOG_PATH);
}

function loadMasterCatalog() {
  return loadWithFallback(FINAL_CATALOG_PATH, LEGACY_CHECKOUT_CATALOG_PATH);
}

function loadCheckoutCompatCatalog() {
  // Retail checkout is authoritative from the published final catalog. Legacy
  // identifiers are handled only through explicit aliases in catalog.js; raw
  // compatibility rows must never override or extend canonical products.
  return loadWithFallback(FINAL_PUBLISHED_CATALOG_PATH, LEGACY_CHECKOUT_CATALOG_PATH);
}

function loadCatalog() {
  return loadCheckoutCompatCatalog();
}

function loadCuratedCatalog() {
  return loadMasterCatalog();
}

function loadPublishedSearchIndex() {
  return loadWithFallback(FINAL_PUBLISHED_SEARCH_INDEX_PATH, LEGACY_SEARCH_INDEX_PATH);
}

function loadMasterSearchIndex() {
  return loadWithFallback(FINAL_SEARCH_INDEX_PATH, LEGACY_SEARCH_INDEX_PATH);
}

function loadSearchIndex() {
  return loadPublishedSearchIndex();
}

function loadPublishedWholesaleCatalog() {
  return loadWithFallback(FINAL_PUBLISHED_WHOLESALE_CATALOG_PATH, LEGACY_WHOLESALE_MUAY_THAI_PATH);
}

function loadMasterWholesaleCatalog() {
  return loadWithFallback(FINAL_WHOLESALE_CATALOG_PATH, LEGACY_WHOLESALE_MUAY_THAI_PATH);
}

function loadWholesaleCatalog() {
  return loadPublishedWholesaleCatalog();
}

module.exports = {
  FINAL_CATALOG_PATH,
  FINAL_PUBLISHED_CATALOG_PATH,
  FINAL_SEARCH_INDEX_PATH,
  FINAL_PUBLISHED_SEARCH_INDEX_PATH,
  FINAL_WHOLESALE_CATALOG_PATH,
  FINAL_PUBLISHED_WHOLESALE_CATALOG_PATH,
  LEGACY_CHECKOUT_CATALOG_PATH,
  LEGACY_CURATED_CATALOG_PATH,
  LEGACY_SEARCH_INDEX_PATH,
  LEGACY_WHOLESALE_MUAY_THAI_PATH,
  LEGACY_WHOLESALE_SUPPLEMENTS_PATH,
  loadCatalog,
  loadCheckoutCompatCatalog,
  loadPublishedCatalog,
  loadMasterCatalog,
  loadCuratedCatalog,
  loadSearchIndex,
  loadPublishedSearchIndex,
  loadMasterSearchIndex,
  loadWholesaleCatalog,
  loadPublishedWholesaleCatalog,
  loadMasterWholesaleCatalog,
};
