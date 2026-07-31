const fs = require("fs");
const path = require("path");
const { handleError, json, methodNotAllowed } = require("../_lib/http");
const {
  collectWholesaleFacets,
  loadPublishedFightCatalogManifest,
  loadWholesaleCatalogManifest,
  matchesWholesaleFilters,
  paginateWholesaleProducts,
} = require("../_lib/wholesale-muay-thai");
const { isHealthCareSupplement, loadSupplementsCatalogManifest } = require("../_lib/wholesale-supplements");

const MAX_PAGE_SIZE = 5000;

// Merchandising order for sort=category: what buyers want to see first.
const CATEGORY_PRIORITY = [
  "Training Gloves",
  "Lace-Up & Fight Gloves",
  "MMA & Grappling Gloves",
  "Bag Gloves",
  "Shin Guards",
  "Shorts",
  "Thai Pads & Kick Pads",
  "Focus Mitts",
  "Body Shields",
  "Headgear",
  "Belly Pads",
  "Mouthguards",
  "Groin Protectors",
  "Ankle & Elbow Supports",
  "Heavy Bags",
  "Hand Wraps & Tape",
  "Mongkol & Prajiad",
  "Jump Ropes",
  "Gym Bag",
  "Boxing Oil & Care",
  "Training Gear",
];
const CATEGORY_RANK = new Map(CATEGORY_PRIORITY.map((label, index) => [label.toLowerCase(), index]));

const COLOR_WORDS = new Set([
  "BLACK", "BLUE", "RED", "WHITE", "YELLOW", "PINK", "PURPLE", "KHAKI", "GOLD", "SILVER",
  "GREEN", "ORANGE", "BEIGE", "GREY", "GRAY", "CREAM", "COPPER", "LIGHT", "DARK", "PEARL", "SKY", "NAVY",
]);

const LIST_EXCLUSION_FILES = {
  muaythai_mma: path.join(__dirname, "..", "_lib", "muaythai-mma-excluded-ids.json"),
};

function listExcludedIds(listName) {
  const file = LIST_EXCLUSION_FILES[String(listName || "").trim()];
  if (!file || !fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function categoryRank(product) {
  const rank = CATEGORY_RANK.get(String(product.category_label || "").trim().toLowerCase());
  return Number.isInteger(rank) ? rank : CATEGORY_PRIORITY.length;
}

// Groups model families together (e.g. all Full Impact colorways) instead of
// alphabetical color-first ordering.
function familySortKey(product) {
  const words = String(product.name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const family = words.filter((word) => !COLOR_WORDS.has(word)).join(" ");
  return `${family}|${words.join(" ")}`;
}

function sortByCategoryPriority(products) {
  return products
    .map((product, index) => ({ product, index, rank: categoryRank(product), key: familySortKey(product) }))
    .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key) || a.index - b.index)
    .map((entry) => entry.product);
}

function normalizePageValue(value, fallback, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maxValue);
}

function queryText(value) {
  return String(value || "").replace(/\+/g, " ").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const listName = queryText(req.query.list);
    const catalogName = queryText(req.query.catalog);
    const catalogGroup = queryText(req.query.catalog_group).toLowerCase();
    const manifest = catalogName === "supplements"
      ? loadSupplementsCatalogManifest()
      : listName === "muaythai_mma"
        ? loadPublishedFightCatalogManifest()
        : loadWholesaleCatalogManifest();
    const filters = {
      search: queryText(req.query.search || req.query.q),
      brand: queryText(req.query.brand),
      category: queryText(req.query.category),
      size: queryText(req.query.size),
      color: queryText(req.query.color),
      availability: queryText(req.query.availability),
    };

    const allowedBrands = new Set(
      String(req.query.brands || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    );
    const excludedIds = new Set(
      String(req.query.exclude_ids || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    for (const id of listExcludedIds(req.query.list)) excludedIds.add(String(id));

    const baseProducts = manifest.products.filter((product) => {
      if (allowedBrands.size && !allowedBrands.has(String(product.brand_slug || "").toLowerCase())) return false;
      if (excludedIds.size && excludedIds.has(String(product.id))) return false;
      if (catalogName === "supplements" && catalogGroup === "health-care" && !isHealthCareSupplement(product)) return false;
      if (catalogName === "supplements" && catalogGroup === "supplements" && isHealthCareSupplement(product)) return false;
      return true;
    });

    const sortMode = String(req.query.sort || "").trim().toLowerCase();
    let filtered = baseProducts.filter((product) => matchesWholesaleFilters(product, filters));
    if (sortMode === "category") filtered = sortByCategoryPriority(filtered);
    const page = normalizePageValue(req.query.page, 1, 9999);
    const pageSize = normalizePageValue(req.query.page_size || req.query.limit, 24, MAX_PAGE_SIZE);
    const pagination = paginateWholesaleProducts(filtered, page, pageSize);
    const facets = collectWholesaleFacets(baseProducts);
    if (sortMode === "category") {
      facets.categories = [...facets.categories].sort(
        (a, b) =>
          (CATEGORY_RANK.get(String(a).toLowerCase()) ?? CATEGORY_PRIORITY.length) -
            (CATEGORY_RANK.get(String(b).toLowerCase()) ?? CATEGORY_PRIORITY.length) ||
          String(a).localeCompare(String(b))
      );
    }
    const categoryCounts = {};
    for (const product of filtered) {
      const label = String(product.category_label || "").trim();
      if (!label) continue;
      categoryCounts[label] = (categoryCounts[label] || 0) + 1;
    }

    json(res, 200, {
      generated_at: manifest.generated_at,
      catalog_group: catalogGroup || null,
      product_count: manifest.products.length,
      filtered_count: filtered.length,
      category_counts: categoryCounts,
      pagination: {
        page: pagination.page,
        page_size: pagination.pageSize,
        total: pagination.total,
        total_pages: pagination.pageSize > 0 ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1,
        has_more: pagination.page * pagination.pageSize < pagination.total,
      },
      facets,
      filters,
      products: pagination.products.map((product) => ({
        id: product.id,
        brand_slug: product.brand_slug,
        brand: product.brand,
        name: product.name,
        url: product.url,
        image_url: product.image_url,
        image_width: product.image_width,
        image_height: product.image_height,
        category_slug: product.category_slug,
        category_label: product.category_label,
        product_type: product.product_type,
        brand_origin: product.brand_origin,
        catalog_visibility: product.catalog_visibility,
        quote_enabled: product.quote_enabled,
        available: product.available,
        availability_status: product.availability_status,
        retail_price_cents: product.retail_price_cents,
        wholesale_price_cents: product.wholesale_price_cents,
        wholesale_discount_bps: product.wholesale_discount_bps,
        trainer_price_cents: product.trainer_price_cents,
        trainer_discount_bps: product.trainer_discount_bps,
        sizes: product.sizes,
        colors: product.colors,
        other_options: product.other_options,
        variant_count: product.variant_count,
      })),
    });
  } catch (error) {
    handleError(res, error);
  }
};
