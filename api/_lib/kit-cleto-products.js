function retailKitCletoProduct(product) {
  if (!product || product.brand !== "Cleto Reyes" || product.available !== true) return null;
  const priceCents = Number(product.price_cents);
  if (!Number.isInteger(priceCents) || priceCents <= 0) return null;
  const id = String(product.id || "");
  if (!id) return null;
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants.map((variant) => ({
        ...variant,
        variant_id: String(variant.variant_id || variant.id || ""),
        price_cents: Number(variant.price_cents || priceCents),
        currency: "USD",
      })).filter((variant) => variant.variant_id && variant.price_cents > 0)
    : [{
        variant_id: `${id}::default`,
        title: "Standard",
        selected_options: {},
        price_cents: priceCents,
        regular_price_cents: Number(product.compare_at_price_cents || priceCents),
        currency: "USD",
        available: true,
        image_url: product.image_url || null,
      }];
  if (!variants.length) return null;
  const apparel = /apparel|shorts?|t-?shirts?|hoodies?/i.test(String(product.category || ""));
  return {
    ...product,
    id,
    url: `/kitbuilder?product=${encodeURIComponent(id)}`,
    image: String(product.image_url || product.images?.[0] || ""),
    price_cents: priceCents,
    price_min_cents: Number(product.price_min_cents || priceCents),
    price_max_cents: Number(product.price_max_cents || priceCents),
    currency: "USD",
    purchasable: true,
    ready_for_sale: true,
    has_pdp: true,
    external_only: false,
    has_variants: true,
    requires_variant_selection: variants.length > 1,
    default_variant_id: variants.length === 1 ? variants[0].variant_id : null,
    section_id: apparel ? "apparel" : "training-gear",
    section_title: String(product.category || "Fight gear"),
    variants,
  };
}

module.exports = { retailKitCletoProduct };
