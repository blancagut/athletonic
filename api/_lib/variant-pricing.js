function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function effectiveVariantPricing(sourceVariant, overrideRow) {
  const sourcePrice = Number(sourceVariant?.price_cents) || 0;
  const sourceCompareAt = Number(sourceVariant?.compare_at_price_cents) || 0;
  if (!overrideRow) {
    return {
      regular_price_cents: sourcePrice,
      offer_price_cents: null,
      offer_enabled: false,
      price_cents: sourcePrice,
      compare_at_price_cents: sourceCompareAt > sourcePrice ? sourceCompareAt : null,
      _override: false,
    };
  }

  const regularPriceCents = Number(overrideRow.regular_price_cents) || 0;
  const offerEnabled = Boolean(overrideRow.offer_enabled);
  const offerPriceCents = overrideRow.offer_price_cents == null
    ? null
    : Number(overrideRow.offer_price_cents) || 0;
  const effectivePriceCents =
    offerEnabled && Number.isInteger(offerPriceCents) ? offerPriceCents : regularPriceCents;
  const compareAtPriceCents =
    offerEnabled && regularPriceCents > effectivePriceCents ? regularPriceCents : null;

  return {
    regular_price_cents: regularPriceCents,
    offer_price_cents: offerEnabled ? offerPriceCents : null,
    offer_enabled: offerEnabled,
    price_cents: effectivePriceCents,
    compare_at_price_cents: compareAtPriceCents,
    _override: true,
  };
}

function applyVariantPriceOverride(variant, overrideRow) {
  const pricing = effectiveVariantPricing(variant, overrideRow);
  return {
    ...variant,
    price_cents: pricing.price_cents,
    regular_price_cents: pricing.regular_price_cents,
    compare_at_price_cents: pricing.compare_at_price_cents,
    offer_price_cents: pricing.offer_price_cents,
    offer_enabled: pricing.offer_enabled,
    _price_override: pricing._override,
  };
}

function summarizeProductFromVariants(product, variants) {
  const pricedVariants = variants.filter((variant) => Number(variant.price_cents) > 0);
  const defaultVariant = variants.find(
    (variant) => String(variant.variant_id) === String(product.default_variant_id || "")
  ) || pricedVariants[0] || variants[0] || null;

  const priceMinCents = pricedVariants.length
    ? Math.min(...pricedVariants.map((variant) => Number(variant.price_cents) || 0))
    : Number(product.price_min_cents || product.price_cents || 0) || 0;
  const priceMaxCents = pricedVariants.length
    ? Math.max(...pricedVariants.map((variant) => Number(variant.price_cents) || 0))
    : Number(product.price_max_cents || product.price_cents || 0) || 0;

  return {
    ...product,
    price_cents: defaultVariant ? Number(defaultVariant.price_cents) || 0 : Number(product.price_cents) || 0,
    regular_price_cents: defaultVariant
      ? Number(defaultVariant.regular_price_cents || defaultVariant.price_cents) || 0
      : Number(product.price_cents) || 0,
    compare_at_price_cents: defaultVariant
      ? defaultVariant.compare_at_price_cents || null
      : product.compare_at_price_cents || null,
    price_min_cents: priceMinCents,
    price_max_cents: priceMaxCents,
    variants,
  };
}

async function loadVariantPricingOverrideMap(supabase, productIds) {
  if (!supabase || !Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  let query = supabase
    .from("product_variant_price_overrides")
    .select("product_id, variant_id, regular_price_cents, offer_price_cents, offer_enabled");

  if (typeof query.in === "function") {
    query = query.in("product_id", productIds.map((productId) => String(productId)));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = new Map();
  for (const row of data || []) {
    const productId = String(row.product_id || "");
    const variantId = String(row.variant_id || "");
    if (!productId || !variantId) continue;
    rows.set(`${productId}::${variantId}`, row);
  }
  return rows;
}

function applyVariantPricingToProduct(product, overrideMap) {
  if (!product || !overrideMap || overrideMap.size === 0) return product;
  const variants = (Array.isArray(product.variants) ? product.variants : []).map((variant) =>
    applyVariantPriceOverride(
      variant,
      overrideMap.get(`${product.id}::${String(variant.variant_id || "")}`) || null
    )
  );

  if (!variants.length) return product;
  return summarizeProductFromVariants(product, variants);
}

module.exports = {
  applyVariantPriceOverride,
  applyVariantPricingToProduct,
  effectiveVariantPricing,
  loadVariantPricingOverrideMap,
  validationError,
};
