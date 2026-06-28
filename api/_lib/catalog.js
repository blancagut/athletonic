const catalog = require("../../data/athletonic-catalog.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CART_ITEMS = 40;
const MAX_ITEM_QUANTITY = 20;

function intCents(value) {
  const cents = Number.parseInt(value, 10);
  return Number.isInteger(cents) && cents > 0 ? cents : 0;
}

function normalizeOptionValues(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((entry, index) => ({
      position: Number(entry.position || index + 1),
      name: String(entry.name || `Option ${index + 1}`).trim(),
      value: String(entry.value || "").trim(),
    }))
    .filter((entry) => entry.name && entry.value);
}

function optionLabel(optionValues) {
  return optionValues.map((entry) => `${entry.name}: ${entry.value}`).join(" / ");
}

function explicitBoolean(value) {
  return value === true || value === false ? value : null;
}

function resolveAvailability(value, fallback, priceCents = 0) {
  const explicit = explicitBoolean(value);
  if (explicit === false && intCents(priceCents) > 0) {
    return true;
  }
  return explicit === null ? fallback : explicit;
}

function normalizeImageUrl(value) {
  const imageUrl = String(value || "").trim();
  return imageUrl || null;
}

function normalizeVariant(product, rawVariant) {
  const variantId = String(rawVariant.variant_id || "").trim();
  if (!variantId) return null;

  const priceCents = intCents(rawVariant.price_cents);
  const regularPriceCents = intCents(rawVariant.regular_price_cents) || priceCents;
  const compareAtPriceCents = intCents(rawVariant.compare_at_price_cents);
  const optionValues = normalizeOptionValues(rawVariant.option_values);

  return {
    product_id: product.id,
    variant_id: variantId,
    title: String(rawVariant.title || optionLabel(optionValues) || "Default").trim(),
    sku: rawVariant.sku ? String(rawVariant.sku) : null,
    option_values: optionValues,
    selected_options: optionValues.reduce((acc, entry) => {
      acc[entry.name] = entry.value;
      return acc;
    }, {}),
    price_cents: priceCents,
    regular_price_cents: regularPriceCents,
    compare_at_price_cents:
      compareAtPriceCents > priceCents ? compareAtPriceCents : null,
    currency: String(rawVariant.currency || product.currency || "USD").toUpperCase(),
    available: resolveAvailability(rawVariant.available, priceCents > 0, priceCents),
    _has_explicit_availability: explicitBoolean(rawVariant.available) !== null,
    image_url: normalizeImageUrl(rawVariant.image_url || rawVariant.image),
    weight_grams: Number.isInteger(Number(rawVariant.weight_grams))
      ? Number(rawVariant.weight_grams)
      : null,
    deal: rawVariant.deal || null,
  };
}

function normalizeProduct(product) {
  const id = String(product.id || "").trim();
  if (!id) return null;

  const priceCents = intCents(product.price_cents);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const normalized = {
    id,
    external_product_id: product.external_product_id || null,
    brand_slug: product.brand_slug || null,
    brand: product.brand || "",
    name: product.name || "",
    sku: product.sku || null,
    url: product.url || null,
    image: product.image || null,
    price_cents: priceCents,
    price_min_cents: intCents(product.price_min_cents) || priceCents,
    price_max_cents: intCents(product.price_max_cents) || priceCents,
    compare_at_price_cents:
      intCents(product.compare_at_price_cents) > priceCents
        ? intCents(product.compare_at_price_cents)
        : null,
    currency: String(product.currency || catalog.currency || "USD").toUpperCase(),
    available: false,
    purchasable: product.purchasable !== false && product.ready_for_sale !== false,
    ready_for_sale: product.ready_for_sale !== false,
    has_variants: product.has_variants === true || variants.length > 0,
    requires_variant_selection: product.requires_variant_selection === true,
    default_variant_id: product.default_variant_id || null,
    section_id: product.section_id || "",
    section_title: product.section_title || "",
  };

  normalized.variants = variants
    .map((variant) => normalizeVariant(normalized, variant))
    .filter(Boolean);

  const hasPricedVariant = normalized.variants.some((variant) => variant.price_cents > 0);
  const hasExplicitVariantAvailability = normalized.variants.some(
    (variant) => variant._has_explicit_availability
  );
  const hasAvailableVariant = normalized.variants.some((variant) => variant.available !== false);
  const fallbackAvailable =
    hasExplicitVariantAvailability && normalized.variants.length > 0
      ? hasAvailableVariant || priceCents > 0
      : priceCents > 0 || hasPricedVariant;
  normalized.available = resolveAvailability(product.available, fallbackAvailable, priceCents);

  return normalized;
}

function buildCatalogIndexes() {
  const products = new Map();
  const variants = new Map();

  for (const rawProduct of Array.isArray(catalog.products) ? catalog.products : []) {
    const product = normalizeProduct(rawProduct);
    if (!product) continue;
    products.set(product.id, product);
    for (const variant of product.variants) {
      variants.set(`${product.id}::${variant.variant_id}`, variant);
    }
  }

  return { products, variants };
}

const { products: productsById, variants: variantsByProductAndId } = buildCatalogIndexes();

function applyVariantOverride(variant, staged) {
  if (!staged || typeof staged !== "object" || Array.isArray(staged)) return variant;

  const next = { ...variant };
  if (staged.price_cents !== undefined) {
    const priceCents = intCents(staged.price_cents);
    if (priceCents > 0) {
      next.price_cents = priceCents;
      if (!next.regular_price_cents || next.regular_price_cents < priceCents) {
        next.regular_price_cents = priceCents;
      }
      if (
        next.compare_at_price_cents != null &&
        next.compare_at_price_cents <= priceCents
      ) {
        next.compare_at_price_cents = null;
      }
    }
  }
  if (staged.available !== undefined) {
    const explicitAvailable = explicitBoolean(staged.available);
    next.available =
      explicitAvailable === null
        ? resolveAvailability(staged.available, next.available, next.price_cents)
        : explicitAvailable;
  }
  if (staged.image_url !== undefined) {
    next.image_url = normalizeImageUrl(staged.image_url);
  }
  return next;
}

function applyProductOverride(product, override) {
  if (!override || typeof override !== "object") return product;

  const patch =
    override.patch && typeof override.patch === "object" && !Array.isArray(override.patch)
      ? override.patch
      : {};
  const variantOverrideMap =
    patch.variant_overrides &&
    typeof patch.variant_overrides === "object" &&
    !Array.isArray(patch.variant_overrides)
      ? patch.variant_overrides
      : {};

  const variants = product.variants.map((variant) =>
    applyVariantOverride(
      variant,
      variantOverrideMap[String(variant.variant_id || "").trim()] || null
    )
  );

  const next = {
    ...product,
    name: typeof patch.name === "string" && patch.name.trim() ? patch.name.trim() : product.name,
    image:
      patch.image !== undefined ? normalizeImageUrl(patch.image) : product.image,
    url: typeof patch.url === "string" && patch.url.trim() ? patch.url.trim() : product.url,
    variants,
  };

  if (patch.price_cents !== undefined) {
    const priceCents = intCents(patch.price_cents);
    if (priceCents > 0) {
      next.price_cents = priceCents;
      next.price_min_cents = priceCents;
      next.price_max_cents = priceCents;
      if (
        next.compare_at_price_cents != null &&
        next.compare_at_price_cents <= priceCents
      ) {
        next.compare_at_price_cents = null;
      }
    }
  }

  const hasPricedVariant = variants.some((variant) => variant.price_cents > 0);
  const hasAvailableVariant = variants.some((variant) => variant.available !== false);
  const fallbackAvailable =
    variants.length > 0 ? hasAvailableVariant || next.price_cents > 0 : next.price_cents > 0 || hasPricedVariant;
  next.available =
    patch.available !== undefined
      ? explicitBoolean(patch.available) === null
        ? resolveAvailability(patch.available, fallbackAvailable, next.price_cents)
        : explicitBoolean(patch.available)
      : resolveAvailability(next.available, fallbackAvailable, next.price_cents);

  return next;
}

function buildIndexesFromProducts(products) {
  const nextProducts = new Map();
  const nextVariants = new Map();

  for (const product of products) {
    nextProducts.set(product.id, product);
    for (const variant of product.variants) {
      nextVariants.set(`${product.id}::${variant.variant_id}`, variant);
    }
  }

  return { products: nextProducts, variants: nextVariants };
}

async function loadOverrideMap(supabase, productIds) {
  if (!supabase || !Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  let query = supabase.from("product_overrides").select("product_id, patch, hidden");
  if (typeof query.in === "function") {
    query = query.in(
      "product_id",
      productIds.map((productId) => String(productId))
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Map((data || []).map((row) => [String(row.product_id), row]));
}

async function loadProductsWithOverrides(productIds, options = {}) {
  const ids = Array.isArray(productIds)
    ? [...new Set(productIds.map((productId) => String(productId || "").trim()).filter(Boolean))]
    : [];
  const overrideMap = await loadOverrideMap(options.supabase || null, ids);
  return ids
    .map((productId) => productsById.get(String(productId)))
    .filter(Boolean)
    .map((product) => applyProductOverride(product, overrideMap.get(String(product.id))));
}

function centsFromMoney(value) {
  return Math.round(Number(value || 0) * 100);
}

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    const error = new Error("Enter a valid email address.");
    error.statusCode = 400;
    error.code = "invalid_email";
    throw error;
  }
  return normalized;
}

function normalizeAttribution(attribution) {
  if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
    return {};
  }

  const allowedKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "fbp",
    "fbc",
    "landing_page",
    "referrer",
    "client_timezone",
  ];

  const clean = {};
  for (const key of allowedKeys) {
    const value = attribution[key];
    if (typeof value === "string" && value.trim()) {
      clean[key] = value.trim().slice(0, 500);
    }
  }

  return clean;
}

function linePriceCents(product, variant, options) {
  if (options && options.priceBasis === "regular") {
    if (variant) return variant.regular_price_cents || variant.price_cents;
    return product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents
      ? product.compare_at_price_cents
      : product.price_cents;
  }
  return variant ? variant.price_cents : product.price_cents;
}

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateCartAgainstIndexes(
  cart,
  activeProductsById,
  activeVariantsByProductAndId,
  options = {}
) {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw validationError("Add at least one product before checkout.", "empty_cart");
  }

  if (cart.length > MAX_CART_ITEMS) {
    throw validationError("Your cart has too many line items.", "cart_too_large");
  }

  const normalized = [];
  const merged = new Map();

  for (const rawItem of cart) {
    const productId = String(rawItem.productId || rawItem.id || "").split("::")[0];
    const product = activeProductsById.get(productId);

    if (!product || product.available === false || product.purchasable === false) {
      throw validationError(
        "One of the products in your cart is not ready for checkout.",
        "product_unavailable"
      );
    }

    const quantity = Number.parseInt(rawItem.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw validationError("One of the products has an invalid quantity.", "invalid_quantity");
    }

    const suppliedVariantId = String(
      rawItem.variant_id || rawItem.variantId || ""
    ).trim();
    let variant = null;

    if (product.has_variants) {
      if (!suppliedVariantId) {
        throw validationError(
          "Choose the required product options before checkout.",
          "variant_required"
        );
      }
      variant = activeVariantsByProductAndId.get(`${productId}::${suppliedVariantId}`);
      if (!variant || variant.available === false) {
        throw validationError(
          "One of the selected product variants is no longer available.",
          "variant_unavailable"
        );
      }
    } else if (suppliedVariantId) {
      throw validationError(
        "One of the selected product variants does not belong to that product.",
        "invalid_variant"
      );
    }

    // Current catalog exports flag `requires_variant_selection` but ship no
    // structured variant rows, so `has_variants` is false and no variant_id can
    // be resolved. The storefront PDP forces the shopper to pick an option and
    // submits it as a free-text label. Require that label server-side so a
    // variant-required product can never reach checkout unspecified (e.g. a
    // hand-crafted API request), and carry it onto the order line for
    // fulfillment. The label never affects price — the catalog price is flat
    // across these options — so this cannot change any amount.
    const clientVariantLabel = String(rawItem.variant || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!variant && product.requires_variant_selection && !clientVariantLabel) {
      throw validationError(
        "Choose the required product options before checkout.",
        "variant_required"
      );
    }

    const variantLabel = variant
      ? variant.title || optionLabel(variant.option_values)
      : clientVariantLabel;
    const mergeKey = `${productId}::${variant ? variant.variant_id : variantLabel}`;
    const existing = merged.get(mergeKey);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_ITEM_QUANTITY) {
        throw validationError("One of the products has an invalid quantity.", "invalid_quantity");
      }
      continue;
    }

    const unitAmountCents = linePriceCents(product, variant, options);
    if (!unitAmountCents || unitAmountCents <= 0) {
      throw validationError(
        "One of the selected product variants has invalid pricing.",
        "invalid_variant_price"
      );
    }

    const lineImageUrl = variant?.image_url || product.image || null;
    merged.set(mergeKey, {
      product_id: productId,
      variant_id: variant ? variant.variant_id : null,
      sku: variant?.sku || product.sku || null,
      brand: product.brand,
      name: product.name,
      variant: variantLabel,
      image_url: lineImageUrl,
      quantity,
      unit_amount_cents: unitAmountCents,
      currency: variant?.currency || product.currency || "USD",
      public_unit_amount_cents: variant?.price_cents || product.price_cents,
      regular_unit_amount_cents: variant?.regular_price_cents || product.price_cents,
      product_snapshot: {
        id: productId,
        external_product_id: product.external_product_id,
        brand_slug: product.brand_slug,
        brand: product.brand,
        name: product.name,
        url: product.url || null,
        image: lineImageUrl,
        image_url: lineImageUrl,
        price_cents: unitAmountCents,
        public_price_cents: variant?.price_cents || product.price_cents,
        regular_price_cents: variant?.regular_price_cents || product.price_cents,
        compare_at_price_cents:
          variant?.compare_at_price_cents || product.compare_at_price_cents,
        currency: variant?.currency || product.currency || "USD",
        section_id: product.section_id || "",
        section_title: product.section_title || "",
        variant_id: variant?.variant_id || null,
        variant_title: variantLabel || null,
        sku: variant?.sku || product.sku || null,
        option_values: variant?.option_values || [],
        selected_options: variant?.selected_options || {},
        catalog_schema_version: catalog.schema_version || 1,
        catalog_generated_at: catalog.generated_at || null,
        deal: variant?.deal || null,
      },
    });
  }

  for (const item of merged.values()) {
    normalized.push(item);
  }

  const currency = normalized[0].currency || "USD";
  if (normalized.some((item) => item.currency !== currency)) {
    throw validationError("All cart items must use the same currency.", "mixed_currency");
  }

  const subtotalCents = normalized.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount_cents,
    0
  );

  return { items: normalized, subtotalCents, currency };
}

function validateCart(cart, options = {}) {
  return validateCartAgainstIndexes(
    cart,
    productsById,
    variantsByProductAndId,
    options
  );
}

async function validateCartWithOverrides(cart, options = {}) {
  const productIds = Array.isArray(cart)
    ? [...new Set(cart.map((item) => String(item?.productId || item?.id || "").split("::")[0]).filter(Boolean))]
    : [];
  const overlaidProducts = await loadProductsWithOverrides(productIds, options);
  if (!overlaidProducts.length) {
    return validateCart(cart, options);
  }
  const { products, variants } = buildIndexesFromProducts(overlaidProducts);

  return validateCartAgainstIndexes(cart, products, variants, options);
}

function getShippingCents(subtotalCents) {
  const shippingCents = Number.parseInt(
    process.env.ATHLETONIC_SHIPPING_AMOUNT_CENTS || "0",
    10
  );
  const freeShippingMinCents = Number.parseInt(
    process.env.ATHLETONIC_FREE_SHIPPING_MIN_CENTS || "0",
    10
  );

  if (freeShippingMinCents > 0 && subtotalCents >= freeShippingMinCents) {
    return 0;
  }

  return Number.isInteger(shippingCents) && shippingCents > 0 ? shippingCents : 0;
}

module.exports = {
  centsFromMoney,
  getShippingCents,
  loadProductsWithOverrides,
  normalizeAttribution,
  normalizeEmail,
  validateCart,
  validateCartWithOverrides,
};
