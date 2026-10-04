const { handleError, json, methodNotAllowed } = require("../_lib/http");
const { loadProductsWithOverrides } = require("../_lib/catalog");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const rawIds = String(
      (req.query && req.query.ids) ||
      (req.url && new URL(req.url, "http://localhost").searchParams.get("ids")) ||
      ""
    );
    const ids = rawIds
      .split(",")
      .map((productId) => String(productId || "").trim())
      .filter(Boolean)
      .slice(0, 50);

    if (!ids.length) {
      json(res, 200, { products: [] });
      return;
    }

    const supabase =
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? getSupabaseAdmin()
        : null;
    const products = await loadProductsWithOverrides(ids, { supabase });

    json(res, 200, { products });
  } catch (error) {
    handleError(res, error);
  }
};
