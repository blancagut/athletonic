const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getQuery, getPagination } = require("../../_lib/admin");
const catalog = require("../../../data/athletonic-catalog.json");

const PRODUCTS = Array.isArray(catalog.products) ? catalog.products : [];

function applyOverride(product, override) {
  if (!override) {
    return {
      ...product,
      _override: false,
      _hidden: false,
      _source_price_cents: product.price_cents,
      _source_available: product.available,
      _source_image: product.image,
      _source_url: product.url,
    };
  }
  return {
    ...product,
    ...(override.patch || {}),
    _override: true,
    _hidden: Boolean(override.hidden),
    _source_price_cents: product.price_cents,
    _source_available: product.available,
    _source_image: product.image,
    _source_url: product.url,
    _updated_at: override.updated_at,
  };
}

function matchesAvailability(product, value) {
  if (!value) return true;
  if (value === "available") return product.available !== false && !product._hidden;
  if (value === "unavailable") return product.available === false;
  if (value === "hidden") return product._hidden;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    await requireAdmin(req);

    const query = getQuery(req);
    const { page, pageSize, from, to } = getPagination(query);
    const supabase = getSupabaseAdmin();

    const { data: overrideRows, error } = await supabase
      .from("product_overrides")
      .select("product_id, patch, hidden, updated_at");
    if (error) throw error;

    const overrides = new Map(
      (overrideRows || []).map((row) => [String(row.product_id), row])
    );

    let list = PRODUCTS.map((p) => applyOverride(p, overrides.get(String(p.id))));

    const search = String(query.search || "").trim().toLowerCase();
    if (search) {
      list = list.filter((p) => {
        const haystack = `${p.name || ""} ${p.brand || ""} ${p.id || ""}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const brand = String(query.brand_slug || "").trim();
    if (brand) {
      list = list.filter((p) => p.brand_slug === brand);
    }

    const section = String(query.section_id || query.category || "").trim();
    if (section) {
      list = list.filter((p) => p.section_id === section);
    }

    const availability = String(query.availability || "").trim();
    if (availability) {
      list = list.filter((p) => matchesAvailability(p, availability));
    }

    const overrideState = String(query.override_state || "").trim();
    if (overrideState === "edited") list = list.filter((p) => p._override);
    if (overrideState === "source") list = list.filter((p) => !p._override);

    const total = list.length;
    const pageItems = list.slice(from, to + 1);

    const brands = [...new Map(PRODUCTS.map((p) => [p.brand_slug, p.brand]).filter(([slug]) => slug)).entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const sections = [...new Map(PRODUCTS.map((p) => [p.section_id, p.section_title]).filter(([id]) => id)).entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));

    json(res, 200, {
      products: pageItems,
      facets: { brands, sections },
      pagination: { page, page_size: pageSize, total },
    });
  } catch (error) {
    handleError(res, error);
  }
};
