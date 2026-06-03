const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");
const catalog = require("../../../data/athletonic-catalog.json");

const PRODUCTS = new Map(
  (Array.isArray(catalog.products) ? catalog.products : []).map((p) => [String(p.id), p])
);

// Fields an admin may override on a product. Everything else is ignored so the
// override patch can never inject arbitrary keys.
const ALLOWED_PATCH_FIELDS = ["name", "price_cents", "available", "image", "url"];

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function buildPatch(body) {
  const patch = {};
  if (body.name !== undefined) {
    patch.name = String(body.name).trim().slice(0, 300);
  }
  if (body.price_cents !== undefined) {
    const cents = Number.parseInt(body.price_cents, 10);
    if (!Number.isInteger(cents) || cents < 0) {
      throw validationError("price_cents must be a non-negative integer.", "invalid_price");
    }
    patch.price_cents = cents;
  }
  if (body.available !== undefined) {
    patch.available = Boolean(body.available);
  }
  if (body.image !== undefined) {
    patch.image = String(body.image).trim().slice(0, 1000) || null;
  }
  if (body.url !== undefined) {
    patch.url = String(body.url).trim().slice(0, 1000) || null;
  }
  // Strip any keys outside the allow-list (defensive).
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PATCH_FIELDS.includes(key)) delete patch[key];
  }
  return patch;
}

module.exports = async function handler(req, res) {
  if (req.method !== "PATCH") {
    methodNotAllowed(res, ["PATCH"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireAdmin(req);

    const productId = getParam(req, "id");
    if (!productId) throw validationError("Missing product id.", "missing_id");
    if (!PRODUCTS.has(String(productId))) {
      const error = new Error("Product not found in catalog.");
      error.statusCode = 404;
      error.code = "product_not_found";
      throw error;
    }

    const body = await readJson(req);
    const patch = buildPatch(body);
    const hidden = body.hidden !== undefined ? Boolean(body.hidden) : undefined;

    if (Object.keys(patch).length === 0 && hidden === undefined) {
      throw validationError("No supported fields to update.", "nothing_to_update");
    }

    const supabase = getSupabaseAdmin();

    const row = {
      product_id: String(productId),
      patch,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };
    if (hidden !== undefined) row.hidden = hidden;

    const { data, error } = await supabase
      .from("product_overrides")
      .upsert(row, { onConflict: "product_id" })
      .select("product_id, patch, hidden, updated_at")
      .single();
    if (error) throw error;

    await logAudit(ctx, "catalog.override", "product", productId, {
      patch,
      hidden,
    });

    json(res, 200, { override: data });
  } catch (error) {
    handleError(res, error);
  }
};
