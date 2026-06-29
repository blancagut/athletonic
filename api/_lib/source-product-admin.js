const { execFileSync } = require("node:child_process");
const path = require("node:path");

const DB_PATH = path.join(process.cwd(), "output", "data", "products.db");
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
let catalogProductsCache = null;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_LENGTH);
}

function escapeSqlText(value) {
  return String(value || "").replace(/'/g, "''");
}

function escapeSqlLike(value) {
  return escapeSqlText(value).replace(/[%_\\]/g, "\\$&");
}

function normalizePage(query) {
  let page = Number.parseInt(query.page, 10);
  let pageSize = Number.parseInt(query.page_size, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function runQuery(sql) {
  try {
    const output = execFileSync("sqlite3", ["-json", DB_PATH, sql], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
    return output ? JSON.parse(output) : [];
  } catch (error) {
    const wrapped = new Error("Could not query the source catalog database.");
    wrapped.statusCode = 500;
    wrapped.code = "source_catalog_unavailable";
    wrapped.cause = error;
    throw wrapped;
  }
}

function searchWhereClause(search) {
  const term = normalizeSearch(search).toLowerCase();
  if (!term) return "1 = 1";

  const exact = escapeSqlText(term);
  const like = escapeSqlLike(term);

  return `
    (
      lower(p.name) like '%${like}%' escape '\\'
      or lower(p.brand) like '%${like}%' escape '\\'
      or lower(coalesce(p.sku, '')) like '%${like}%' escape '\\'
      or cast(p.id as text) = '${exact}'
      or exists (
        select 1
        from variants sv
        where sv.product_row_id = p.id
          and (
            cast(sv.variant_id as text) = '${exact}'
            or lower(coalesce(sv.sku, '')) like '%${like}%' escape '\\'
            or lower(coalesce(sv.title, '')) like '%${like}%' escape '\\'
          )
      )
    )
  `;
}

function formatMoneyCents(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function brandLabel(value) {
  return String(value || "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function loadCatalogProductsFallback() {
  if (catalogProductsCache) return catalogProductsCache;

  const catalogModule = require("../../data/athletonic-catalog.json");
  const products = Array.isArray(catalogModule)
    ? catalogModule
    : Array.isArray(catalogModule.products)
      ? catalogModule.products
      : [];

  catalogProductsCache = products;
  return catalogProductsCache;
}

function productMatchesSearch(product, term) {
  if (!term) return true;

  const normalized = String(term).toLowerCase();
  const productValues = [
    product.name,
    product.brand,
    product.brand_slug,
    product.sku,
    product.id,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  if (productValues.some((value) => value.includes(normalized) || value === normalized)) {
    return true;
  }

  return (Array.isArray(product.variants) ? product.variants : []).some((variant) => {
    const optionValues = Array.isArray(variant.option_values)
      ? variant.option_values.map((entry) => entry && entry.value)
      : [];
    return [variant.variant_id, variant.sku, variant.title, ...optionValues]
      .map((value) => String(value || "").toLowerCase())
      .filter(Boolean)
      .some((value) => value.includes(normalized) || value === normalized);
  });
}

function mapCatalogProductSummary(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const pricedVariants = variants.filter((variant) => Number(variant.price_cents) > 0);
  return {
    id: String(product.id || ""),
    brand_slug: String(product.brand_slug || ""),
    brand: String(product.brand || brandLabel(product.brand_slug || "")),
    name: String(product.name || ""),
    sku: product.sku ? String(product.sku) : null,
    currency: String(product.currency || "USD").toUpperCase(),
    product_price_cents: Number(product.price_cents) || 0,
    variant_count: variants.length,
    available_variant_count: variants.filter((variant) => Boolean(variant.available)).length,
    min_variant_price_cents: pricedVariants.length
      ? Math.min(...pricedVariants.map((variant) => Number(variant.price_cents) || 0))
      : Number(product.price_cents) || 0,
    max_variant_price_cents: pricedVariants.length
      ? Math.max(...pricedVariants.map((variant) => Number(variant.price_cents) || 0))
      : Number(product.price_cents) || 0,
  };
}

function searchSourceProductsFallback(query) {
  const { page, pageSize, offset } = normalizePage(query || {});
  const term = normalizeSearch(query && query.search).toLowerCase();
  const products = loadCatalogProductsFallback()
    .filter((product) => productMatchesSearch(product, term))
    .sort((a, b) => {
      const nameCompare = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });
      if (nameCompare !== 0) return nameCompare;
      return String(b.id || "").localeCompare(String(a.id || ""), undefined, {
        numeric: true,
      });
    });

  return {
    products: products.slice(offset, offset + pageSize).map(mapCatalogProductSummary),
    pagination: {
      page,
      page_size: pageSize,
      total: products.length,
    },
  };
}

function searchSourceProducts(query) {
  try {
    const { page, pageSize, offset } = normalizePage(query || {});
    const where = searchWhereClause(query && query.search);

    const countSql = `
      select count(*) as total
      from products p
      where ${where};
    `;
    const totalRows = runQuery(countSql);
    const total = Number(totalRows[0] && totalRows[0].total) || 0;

    const listSql = `
      select
        p.id,
        p.brand,
        p.name,
        p.sku,
        coalesce(p.currency, 'USD') as currency,
        round(coalesce(p.price, 0) * 100) as product_price_cents,
        count(v.id) as variant_count,
        sum(case when v.available = 1 then 1 else 0 end) as available_variant_count,
        min(case when v.price is not null then round(v.price * 100) end) as min_variant_price_cents,
        max(case when v.price is not null then round(v.price * 100) end) as max_variant_price_cents
      from products p
      left join variants v on v.product_row_id = p.id
      where ${where}
      group by p.id, p.brand, p.name, p.sku, p.currency, p.price
      order by p.name collate nocase asc, p.id desc
      limit ${pageSize}
      offset ${offset};
    `;

    const rows = runQuery(listSql);
    return {
      products: rows.map((row) => ({
        id: String(row.id),
        brand_slug: String(row.brand || ""),
        brand: brandLabel(row.brand),
        name: String(row.name || ""),
        sku: row.sku ? String(row.sku) : null,
        currency: String(row.currency || "USD").toUpperCase(),
        product_price_cents: Number(row.product_price_cents) || 0,
        variant_count: Number(row.variant_count) || 0,
        available_variant_count: Number(row.available_variant_count) || 0,
        min_variant_price_cents: Number(row.min_variant_price_cents) || 0,
        max_variant_price_cents: Number(row.max_variant_price_cents) || 0,
      })),
      pagination: {
        page,
        page_size: pageSize,
        total,
      },
    };
  } catch (error) {
    if (error && error.code === "source_catalog_unavailable") {
      return searchSourceProductsFallback(query);
    }
    throw error;
  }
}

function parseCatalogOptionNames(rawOptions) {
  try {
    const parsed = JSON.parse(rawOptions || "[]");
    return Array.isArray(parsed)
      ? parsed
          .map((entry, index) => String(entry && entry.name ? entry.name : `Option ${index + 1}`).trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function getSourceProductDetail(productId) {
  const numericId = Number.parseInt(String(productId || "").trim(), 10);
  if (!Number.isInteger(numericId) || numericId < 1) {
    throw validationError("Invalid product id.", "invalid_product_id");
  }

  try {
    const productRows = runQuery(`
      select
        p.id,
        p.brand,
        p.name,
        p.sku,
        p.url,
        p.options,
        round(coalesce(p.price, 0) * 100) as product_price_cents,
        round(coalesce(p.compare_at_price, 0) * 100) as product_compare_at_price_cents,
        coalesce(p.currency, 'USD') as currency
      from products p
      where p.id = ${numericId}
      limit 1;
    `);

    const productRow = productRows[0];
    if (!productRow) {
      const error = new Error("Product not found.");
      error.statusCode = 404;
      error.code = "product_not_found";
      throw error;
    }

    const optionNames = parseCatalogOptionNames(productRow.options);
    const variantRows = runQuery(`
      select
        v.variant_id,
        v.title,
        v.sku,
        v.option1,
        v.option2,
        v.option3,
        round(coalesce(v.price, 0) * 100) as price_cents,
        round(coalesce(v.compare_at_price, 0) * 100) as compare_at_price_cents,
        case when v.available = 1 then 1 else 0 end as available
      from variants v
      where v.product_row_id = ${numericId}
      order by v.id asc;
    `);

    return {
      id: String(productRow.id),
      brand_slug: String(productRow.brand || ""),
      brand: brandLabel(productRow.brand),
      name: String(productRow.name || ""),
      sku: productRow.sku ? String(productRow.sku) : null,
      url: productRow.url ? String(productRow.url) : null,
      currency: String(productRow.currency || "USD").toUpperCase(),
      product_price_cents: Number(productRow.product_price_cents) || 0,
      product_compare_at_price_cents: Number(productRow.product_compare_at_price_cents) || 0,
      variants: variantRows.map((row) => {
        const rawOptions = [row.option1, row.option2, row.option3]
          .map((value, index) => {
            const clean = String(value || "").trim();
            if (!clean) return null;
            return {
              name: optionNames[index] || `Option ${index + 1}`,
              value: clean,
            };
          })
          .filter(Boolean);

        return {
          variant_id: String(row.variant_id || ""),
          title: String(row.title || "").trim() || rawOptions.map((entry) => entry.value).join(" / ") || "Default",
          sku: row.sku ? String(row.sku) : null,
          available: Number(row.available) === 1,
          price_cents: Number(row.price_cents) || 0,
          compare_at_price_cents: Number(row.compare_at_price_cents) || 0,
          option_values: rawOptions,
        };
      }),
    };
  } catch (error) {
    if (!error || error.code !== "source_catalog_unavailable") throw error;

    const product = loadCatalogProductsFallback().find(
      (entry) => String(entry && entry.id) === String(numericId)
    );
    if (!product) {
      const notFound = new Error("Product not found.");
      notFound.statusCode = 404;
      notFound.code = "product_not_found";
      throw notFound;
    }

    return {
      id: String(product.id || ""),
      brand_slug: String(product.brand_slug || ""),
      brand: String(product.brand || brandLabel(product.brand_slug || "")),
      name: String(product.name || ""),
      sku: product.sku ? String(product.sku) : null,
      url: product.url ? String(product.url) : null,
      currency: String(product.currency || "USD").toUpperCase(),
      product_price_cents: Number(product.price_cents) || 0,
      product_compare_at_price_cents: Number(product.compare_at_price_cents) || 0,
      variants: (Array.isArray(product.variants) ? product.variants : []).map((variant) => ({
        variant_id: String(variant.variant_id || ""),
        title: String(variant.title || "").trim() || "Default",
        sku: variant.sku ? String(variant.sku) : null,
        available: Boolean(variant.available),
        price_cents: Number(variant.regular_price_cents || variant.price_cents) || 0,
        compare_at_price_cents: Number(variant.compare_at_price_cents) || 0,
        option_values: Array.isArray(variant.option_values)
          ? variant.option_values
              .map((entry, index) => {
                const value = String(entry && entry.value ? entry.value : "").trim();
                if (!value) return null;
                return {
                  name: String(entry && entry.name ? entry.name : `Option ${index + 1}`),
                  value,
                };
              })
              .filter(Boolean)
          : [],
      })),
    };
  }
}

module.exports = {
  getSourceProductDetail,
  searchSourceProducts,
  validationError,
};
