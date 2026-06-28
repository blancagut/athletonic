const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");
const catalog = require("../../../data/athletonic-catalog.json");

const PRODUCTS = new Map(
  (Array.isArray(catalog.products) ? catalog.products : []).map((p) => [String(p.id), p])
);

// Fields an admin may override on a product. Everything else is ignored so the
// override patch can never inject arbitrary keys.
const ALLOWED_PATCH_FIELDS = ["name", "price_cents", "available", "image", "url", "variant_overrides"];
const ALLOWED_VARIANT_PATCH_FIELDS = ["price_cents", "available", "image_url"];

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function validateHttpUrl(rawValue, fieldName, code) {
  const value = String(rawValue || "").trim().slice(0, 1000);
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw validationError(`${fieldName} must use http or https.`, code);
    }
    return parsed.href;
  } catch (error) {
    if (error.code === code) throw error;
    throw validationError(`${fieldName} must be a valid URL.`, code);
  }
}

function buildVariantOverrides(product, input) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError(
      "variant_overrides must be an object keyed by variant id.",
      "invalid_variant_overrides"
    );
  }

  const sourceVariants = Array.isArray(product?.variants) ? product.variants : [];
  const sourceVariantIds = new Set(
    sourceVariants.map((variant) => String(variant?.variant_id || "").trim()).filter(Boolean)
  );
  const clean = {};

  for (const [rawVariantId, rawPatch] of Object.entries(input)) {
    const variantId = String(rawVariantId || "").trim();
    if (!variantId || !sourceVariantIds.has(variantId)) {
      throw validationError(
        `Unknown variant override target: ${variantId || "(missing id)"}.`,
        "invalid_variant_override_target"
      );
    }
    if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
      throw validationError(
        `Variant override for ${variantId} must be an object.`,
        "invalid_variant_override"
      );
    }

    const staged = {};
    if (rawPatch.price_cents !== undefined && rawPatch.price_cents !== "") {
      const cents = Number.parseInt(rawPatch.price_cents, 10);
      if (!Number.isInteger(cents) || cents < 0) {
        throw validationError(
          `Variant ${variantId} price_cents must be a non-negative integer.`,
          "invalid_variant_price"
        );
      }
      staged.price_cents = cents;
    }
    if (rawPatch.available !== undefined && rawPatch.available !== "") {
      if (rawPatch.available === true || rawPatch.available === false) {
        staged.available = rawPatch.available;
      } else if (rawPatch.available === "true" || rawPatch.available === "false") {
        staged.available = rawPatch.available === "true";
      } else {
        throw validationError(
          `Variant ${variantId} available must be true or false.`,
          "invalid_variant_availability"
        );
      }
    }
    if (rawPatch.image_url !== undefined && String(rawPatch.image_url).trim()) {
      staged.image_url = validateHttpUrl(
        rawPatch.image_url,
        `Variant ${variantId} image URL`,
        "invalid_variant_image_url"
      );
    }

    for (const key of Object.keys(staged)) {
      if (!ALLOWED_VARIANT_PATCH_FIELDS.includes(key)) delete staged[key];
    }
    if (Object.keys(staged).length > 0) {
      clean[variantId] = staged;
    }
  }

  return clean;
}

function buildPatch(product, body) {
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
    patch.url = validateHttpUrl(body.url, "Product URL", "invalid_product_url");
  }
  if (body.variant_overrides !== undefined) {
    patch.variant_overrides = buildVariantOverrides(product, body.variant_overrides);
  }
  // Strip any keys outside the allow-list (defensive).
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_PATCH_FIELDS.includes(key)) delete patch[key];
  }
  return patch;
}

module.exports = async function handler(req, res) {
  if (!["PATCH", "DELETE"].includes(req.method)) {
    methodNotAllowed(res, ["PATCH", "DELETE"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireSuperAdmin(req);

    const productId = getParam(req, "id");
    if (!productId) throw validationError("Missing product id.", "missing_id");
    const product = PRODUCTS.get(String(productId));
    if (!product) {
      const error = new Error("Product not found in catalog.");
      error.statusCode = 404;
      error.code = "product_not_found";
      throw error;
    }

    const supabase = getSupabaseAdmin();

    if (req.method === "DELETE") {
      const { error } = await supabase
        .from("product_overrides")
        .delete()
        .eq("product_id", String(productId));
      if (error) throw error;

      await logAudit(ctx, "catalog.override_reset", "product", productId, {});
      json(res, 200, { ok: true, product_id: String(productId), override: null });
      return;
    }

    const body = await readJson(req);
    const existingOverride = await supabase
      .from("product_overrides")
      .select("patch")
      .eq("product_id", String(productId))
      .maybeSingle();
    if (existingOverride.error) throw existingOverride.error;

    const patch = buildPatch(product, body);
    if (
      body.variant_overrides === undefined &&
      existingOverride.data?.patch &&
      typeof existingOverride.data.patch.variant_overrides === "object" &&
      !Array.isArray(existingOverride.data.patch.variant_overrides)
    ) {
      patch.variant_overrides = existingOverride.data.patch.variant_overrides;
    }
    const hidden = body.hidden !== undefined ? Boolean(body.hidden) : undefined;

    if (Object.keys(patch).length === 0 && hidden === undefined) {
      throw validationError("No supported fields to update.", "nothing_to_update");
    }

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
