function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function retailKitTwinsProductFromWholesale(product) {
  if (!product || product.brand !== "Twins Special" || product.available !== true) {
    return null;
  }
  const priceCents = Number(product.retail_price_cents);
  if (!Number.isInteger(priceCents) || priceCents <= 0) return null;
  const sizes = Array.isArray(product.sizes)
    ? product.sizes.filter((size) => size && !/^\s*(?:one|1)\s*size\s*$/i.test(size))
    : [];
  const colors = Array.isArray(product.colors)
    ? product.colors.filter((color) => color && !/referencial|reference/i.test(color))
    : [];
  const options = sizes.length && colors.length
    ? sizes.flatMap((size) => colors.map((color) => ({ Size: size, Color: color })))
    : sizes.length
      ? sizes.map((size) => ({ Size: size }))
      : colors.length
        ? colors.map((color) => ({ Color: color }))
        : [{}];
  if (Number(product.variant_count) > 0 && options.length !== Number(product.variant_count)) {
    return null;
  }
  const images = Array.isArray(product.images)
    ? product.images.map((image) => image?.url).filter(Boolean)
    : [];
  const image = String(product.image_url || images[0] || "");
  const id = String(product.id);
  const variants = options.map((selectedOptions) => {
    const label = Object.values(selectedOptions).join(" / ");
    return {
      variant_id: `${id}::${label ? slug(label) : "default"}`,
      title: label || "One size",
      sku: `${id}${label ? `-${slug(label)}` : ""}`,
      selected_options: selectedOptions,
      price_cents: priceCents,
      regular_price_cents: priceCents,
      currency: "USD",
      available: true,
      image_url: image,
    };
  });
  const apparel = /t-?shirts?|sauna suits?|training suits?/i.test(String(product.product_type || ""));
  return {
    id,
    brand_slug: "twins_special",
    brand: "Twins Special",
    name: String(product.name),
    url: `/kitbuilder?product=${encodeURIComponent(id)}`,
    image,
    images,
    price_cents: priceCents,
    price_min_cents: priceCents,
    price_max_cents: priceCents,
    currency: "USD",
    available: true,
    purchasable: true,
    ready_for_sale: true,
    has_pdp: true,
    external_only: false,
    has_variants: true,
    requires_variant_selection: variants.length > 1,
    default_variant_id: variants.length === 1 ? variants[0].variant_id : null,
    section_id: apparel ? "apparel" : "accessories",
    section_title: String(product.product_type || "Fight gear"),
    variants,
  };
}

module.exports = { retailKitTwinsProductFromWholesale };
