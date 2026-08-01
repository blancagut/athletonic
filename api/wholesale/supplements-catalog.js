const { handleError, json, methodNotAllowed } = require("../_lib/http");
const {
  collectWholesaleFacets,
  matchesWholesaleFilters,
  paginateWholesaleProducts,
} = require("../_lib/wholesale-muay-thai");
const { isHealthCareSupplement, loadSupplementsCatalogManifest } = require("../_lib/wholesale-supplements");

const MAX_PAGE_SIZE = 48;

function normalizePageValue(value, fallback, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maxValue);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const manifest = loadSupplementsCatalogManifest();
    const catalogGroup = String(req.query.catalog_group || "supplements").trim().toLowerCase();
    const filters = {
      search: String(req.query.search || req.query.q || "").trim(),
      brand: String(req.query.brand || "").trim(),
      category: String(req.query.category || "").trim(),
      size: String(req.query.size || "").trim(),
      color: String(req.query.color || "").trim(),
      availability: String(req.query.availability || "").trim(),
    };

    const baseProducts = manifest.products.filter((product) => {
      if (catalogGroup === "health-care") return isHealthCareSupplement(product);
      return !isHealthCareSupplement(product);
    });
    const filtered = baseProducts.filter((product) => matchesWholesaleFilters(product, filters));
    const page = normalizePageValue(req.query.page, 1, 9999);
    const pageSize = normalizePageValue(req.query.page_size || req.query.limit, 24, MAX_PAGE_SIZE);
    const pagination = paginateWholesaleProducts(filtered, page, pageSize);
    const facets = collectWholesaleFacets(baseProducts);

    json(res, 200, {
      generated_at: manifest.generated_at,
      catalog_group: catalogGroup,
      product_count: baseProducts.length,
      filtered_count: filtered.length,
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
        variants: product.variants,
      })),
    });
  } catch (error) {
    handleError(res, error);
  }
};
