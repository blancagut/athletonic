const path = require("node:path");
const { retailKitTwinsProductFromWholesale } = require("./kit-twins-products");
const { retailKitCletoProduct } = require("./kit-cleto-products");
const cletoKitSource = require("../../data/cleto-reyes-products.json");

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

function mergeMissingProducts(primary, secondaryCatalog) {
  const primaryProducts = Array.isArray(primary?.products) ? primary.products : [];
  const secondaryProducts = Array.isArray(secondaryCatalog?.products)
    ? secondaryCatalog.products
    : [];

  if (!primaryProducts.length || !secondaryProducts.length) return primary;

  const seen = new Set(primaryProducts.map((product) => String(product?.id || "")));
  const extras = secondaryProducts.filter((product) => {
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
  // Retail checkout stays authoritative from the published final catalog, but
  // some live PDPs still source from the published wholesale feed. We merge
  // only missing product ids so canonical retail rows always win.
  const primary = loadWithFallback(
    FINAL_PUBLISHED_CATALOG_PATH,
    LEGACY_CHECKOUT_CATALOG_PATH
  );
  const withLegacyExtras = mergeLegacyCheckoutExtras(primary);
  const withCleto = mergeMissingProducts(withLegacyExtras, {
    products: (cletoKitSource.products || []).map(retailKitCletoProduct).filter(Boolean),
  });
  const wholesale = loadWithFallback(
    FINAL_PUBLISHED_WHOLESALE_CATALOG_PATH,
    LEGACY_WHOLESALE_MUAY_THAI_PATH
  );
  const retailReadyWholesale = {
    ...wholesale,
    products: (wholesale.products || []).map((product) => retailKitTwinsProductFromWholesale(product) || product),
  };
  return mergeMissingProducts(withCleto, retailReadyWholesale);
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
