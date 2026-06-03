const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getQuery, getPagination } = require("../../_lib/admin");
const catalog = require("../../../data/athletonic-catalog.json");

const PRODUCTS = Array.isArray(catalog.products) ? catalog.products : [];

function applyOverride(product, override) {
  if (!override) return { ...product, _override: false, _hidden: false };
  return {
    ...product,
    ...(override.patch || {}),
    _override: true,
    _hidden: Boolean(override.hidden),
    _updated_at: override.updated_at,
  };
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

    let list = PRODUCTS;

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

    const total = list.length;
    const pageItems = list
      .slice(from, to + 1)
      .map((p) => applyOverride(p, overrides.get(String(p.id))));

    json(res, 200, {
      products: pageItems,
      pagination: { page, page_size: pageSize, total },
    });
  } catch (error) {
    handleError(res, error);
  }
};
