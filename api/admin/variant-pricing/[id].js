const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getParam, getQuery } = require("../../_lib/admin");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getSourceProductDetail } = require("../../_lib/source-product-admin");
const {
  effectiveVariantPricing,
  validationError,
} = require("../../_lib/variant-pricing");

function indexOverrides(rows) {
  return new Map(
    (rows || []).map((row) => [`${String(row.product_id)}::${String(row.variant_id)}`, row])
  );
}

function buildVariantPayload(sourceVariant, overrideRow) {
  const pricing = effectiveVariantPricing(sourceVariant, overrideRow);
  return {
    variant_id: String(sourceVariant.variant_id || ""),
    title: sourceVariant.title || "Default",
    sku: sourceVariant.sku || null,
    available: sourceVariant.available !== false,
    option_values: Array.isArray(sourceVariant.option_values) ? sourceVariant.option_values : [],
    source_price_cents: Number(sourceVariant.price_cents) || 0,
    source_compare_at_price_cents:
      Number(sourceVariant.compare_at_price_cents) > Number(sourceVariant.price_cents)
        ? Number(sourceVariant.compare_at_price_cents)
        : null,
    regular_price_cents: pricing.regular_price_cents,
    offer_price_cents: pricing.offer_price_cents,
    offer_enabled: pricing.offer_enabled,
    effective_price_cents: pricing.price_cents,
    effective_compare_at_price_cents: pricing.compare_at_price_cents,
    _override: pricing._override,
  };
}

async function loadProductResponse(supabase, productId) {
  const product = getSourceProductDetail(productId);
  const { data, error } = await supabase
    .from("product_variant_price_overrides")
    .select(
      "product_id, variant_id, regular_price_cents, offer_price_cents, offer_enabled, updated_at"
    )
    .eq("product_id", String(productId));
  if (error) throw error;

  const overrideMap = indexOverrides(data || []);
  return {
    product: {
      id: product.id,
      brand_slug: product.brand_slug,
      brand: product.brand,
      name: product.name,
      sku: product.sku,
      currency: product.currency,
      variant_count: product.variants.length,
      variants: product.variants.map((variant) =>
        buildVariantPayload(
          variant,
          overrideMap.get(`${product.id}::${String(variant.variant_id || "")}`) || null
        )
      ),
    },
  };
}

function normalizeVariantPatch(product, body) {
  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    throw validationError("variants must be a non-empty array.", "invalid_variants");
  }

  const sourceVariantsById = new Map(
    (product.variants || []).map((variant) => [String(variant.variant_id || ""), variant])
  );

  return body.variants.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw validationError("Each variant update must be an object.", "invalid_variant_update");
    }

    const allowedKeys = [
      "variant_id",
      "regular_price_cents",
      "offer_price_cents",
      "offer_enabled",
    ];
    for (const key of Object.keys(entry)) {
      if (!allowedKeys.includes(key)) {
        throw validationError(`Unsupported field: ${key}.`, "unsupported_variant_field");
      }
    }

    const variantId = String(entry.variant_id || "").trim();
    const sourceVariant = sourceVariantsById.get(variantId);
    if (!variantId || !sourceVariant) {
      throw validationError(
        `Variant ${variantId || "(missing id)"} does not belong to this product.`,
        "invalid_variant_target"
      );
    }

    const regularPriceCents = Number.parseInt(entry.regular_price_cents, 10);
    if (!Number.isInteger(regularPriceCents) || regularPriceCents < 0) {
      throw validationError(
        `Variant ${variantId} regular_price_cents must be a non-negative integer.`,
        "invalid_regular_price"
      );
    }

    const offerEnabled = Boolean(entry.offer_enabled);
    let offerPriceCents = null;
    if (entry.offer_price_cents !== undefined && entry.offer_price_cents !== null && entry.offer_price_cents !== "") {
      offerPriceCents = Number.parseInt(entry.offer_price_cents, 10);
      if (!Number.isInteger(offerPriceCents) || offerPriceCents < 0) {
        throw validationError(
          `Variant ${variantId} offer_price_cents must be a non-negative integer.`,
          "invalid_offer_price"
        );
      }
    }

    if (offerEnabled) {
      if (!Number.isInteger(offerPriceCents)) {
        throw validationError(
          `Variant ${variantId} needs offer_price_cents when offer_enabled is true.`,
          "missing_offer_price"
        );
      }
      if (offerPriceCents >= regularPriceCents) {
        throw validationError(
          `Variant ${variantId} offer_price_cents must be lower than regular_price_cents.`,
          "invalid_offer_relationship"
        );
      }
    } else {
      offerPriceCents = null;
    }

    return {
      product_id: product.id,
      variant_id: variantId,
      regular_price_cents: regularPriceCents,
      offer_price_cents: offerPriceCents,
      offer_enabled: offerEnabled,
    };
  });
}

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH", "DELETE"].includes(req.method)) {
    methodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireSuperAdmin(req);
    const productId = getParam(req, "id");
    if (!productId) throw validationError("Missing product id.", "missing_product_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      json(res, 200, await loadProductResponse(supabase, productId));
      return;
    }

    const product = getSourceProductDetail(productId);

    if (req.method === "DELETE") {
      const query = getQuery(req);
      const variantId = String(query.variant_id || "").trim();
      const sourceVariant = (product.variants || []).find(
        (variant) => String(variant.variant_id || "") === variantId
      );
      if (!variantId || !sourceVariant) {
        throw validationError(
          "variant_id is required and must belong to the product.",
          "invalid_variant_target"
        );
      }

      const { error } = await supabase
        .from("product_variant_price_overrides")
        .delete()
        .eq("product_id", String(productId))
        .eq("variant_id", variantId);
      if (error) throw error;

      await logAudit(ctx, "variant_pricing.reset", "product_variant", `${productId}:${variantId}`, {
        product_id: String(productId),
        variant_id: variantId,
      });

      json(res, 200, {
        ok: true,
        product_id: String(productId),
        variant_id: variantId,
      });
      return;
    }

    const body = await readJson(req);
    const rows = normalizeVariantPatch(product, body).map((row) => ({
      ...row,
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("product_variant_price_overrides")
      .upsert(rows, { onConflict: "product_id,variant_id" })
      .select(
        "product_id, variant_id, regular_price_cents, offer_price_cents, offer_enabled, updated_at"
      );
    if (error) throw error;

    await logAudit(ctx, "variant_pricing.upsert", "product", String(productId), {
      variants: rows.map((row) => ({
        variant_id: row.variant_id,
        regular_price_cents: row.regular_price_cents,
        offer_price_cents: row.offer_price_cents,
        offer_enabled: row.offer_enabled,
      })),
    });

    json(res, 200, {
      overrides: data || [],
      ...(await loadProductResponse(supabase, productId)),
    });
  } catch (error) {
    handleError(res, error);
  }
};
