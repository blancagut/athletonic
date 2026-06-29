const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin } = require("../../_lib/auth");
const { getQuery } = require("../../_lib/admin");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { searchSourceProducts } = require("../../_lib/source-product-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    await requireSuperAdmin(req);

    const query = getQuery(req);
    const result = searchSourceProducts(query);
    const products = result.products;
    const productIds = products.map((product) => String(product.id));
    const supabase = getSupabaseAdmin();

    let overrideRows = [];
    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from("product_variant_price_overrides")
        .select("product_id, variant_id, offer_enabled")
        .in("product_id", productIds);
      if (error) throw error;
      overrideRows = data || [];
    }

    const byProduct = new Map();
    for (const row of overrideRows) {
      const productId = String(row.product_id || "");
      if (!productId) continue;
      const current = byProduct.get(productId) || {
        override_variant_count: 0,
        active_offer_variant_count: 0,
      };
      current.override_variant_count += 1;
      if (row.offer_enabled) current.active_offer_variant_count += 1;
      byProduct.set(productId, current);
    }

    json(res, 200, {
      products: products.map((product) => ({
        ...product,
        override_variant_count: byProduct.get(String(product.id))?.override_variant_count || 0,
        active_offer_variant_count:
          byProduct.get(String(product.id))?.active_offer_variant_count || 0,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    handleError(res, error);
  }
};
