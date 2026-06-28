const catalog = require("../../data/athletonic-catalog.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CART_ITEMS = 40;
const MAX_ITEM_QUANTITY = 20;
const LEGACY_PRODUCT_ID_ALIASES = Object.freeze({
  "1509-extreme": {
    product_id: "1509",
    flavor: "Extreme Milk Chocolate",
  },
  "1509-other": {
    product_id: "1509",
  },
  "1509-vanilla": {
    product_id: "1509",
    flavor: "Vanilla Ice Cream",
  },
});

function legacyProductAlias(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const productId = raw.split("::")[0].trim();
  if (!productId) return null;
  return LEGACY_PRODUCT_ID_ALIASES[productId] || null;
}

function normalizeProductId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const productId = raw.split("::")[0].trim();
  if (!productId) return "";
  return legacyProductAlias(productId)?.product_id || productId;
}

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

function normalizeQuantity(value) {
  const quantity = Number.parseInt(value, 10);
  return Number.isInteger(quantity) ? quantity : NaN;
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function stripPackSuffix(value) {
  return normalizeText(value).replace(/\s*\(pack of\s+\d+\)\s*/gi, " ");
}

function stripTrailingZeros(value) {
  return String(value).replace(/(?:\.0+|(\.\d*[1-9])0+)$/, "$1");
}

function normalizeSizeToken(value) {
  const text = stripPackSuffix(value).toLowerCase();
  if (!text) return "";

  const ounceMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)\b/);
  if (ounceMatch) {
    const pounds = Number(ounceMatch[1]) / 16;
    return `${stripTrailingZeros(pounds.toFixed(2))} lb`;
  }

  const poundMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/);
  if (poundMatch) {
    return `${stripTrailingZeros(poundMatch[1])} lb`;
  }

  return text
    .replace(/\b(?:lbs?|pounds?)\b/gi, "lb")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparisonLabel(value) {
  return stripPackSuffix(value)
    .split("/")
    .map((part) => normalizeSizeToken(part))
    .join(" / ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeOptionName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeOptionValue(value) {
  return normalizeComparisonLabel(value);
}

function normalizeSelectedOptions(selectedOptions) {
  if (
    !selectedOptions ||
    typeof selectedOptions !== "object" ||
    Array.isArray(selectedOptions)
  ) {
    return {};
  }

  const out = {};
  for (const key of Object.keys(selectedOptions).sort()) {
    const cleanKey = normalizeText(key);
    const cleanValue = normalizeText(selectedOptions[key]);
    if (cleanKey && cleanValue) {
      out[cleanKey] = cleanValue;
    }
  }

  return out;
}

function normalizedSelectedOptionsSignature(optionValues) {
  const values = Array.isArray(optionValues) ? optionValues : [];
  return values
    .map((entry, index) => ({
      name: normalizeOptionName(entry && (entry.name || entry.label || `Option ${index + 1}`)),
      value: normalizeOptionValue(entry && (entry.value || entry.selected_value || "")),
    }))
    .filter((entry) => entry.name && entry.value)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${entry.name}:${entry.value}`)
    .join("|");
}

function normalizeSelectedOptionsSignature(selectedOptions) {
  if (!selectedOptions || typeof selectedOptions !== "object" || Array.isArray(selectedOptions)) {
    return "";
  }

  return Object.keys(selectedOptions)
    .map((key) => ({
      name: normalizeOptionName(key),
      value: normalizeOptionValue(selectedOptions[key]),
    }))
    .filter((entry) => entry.name && entry.value)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${entry.name}:${entry.value}`)
    .join("|");
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
    ? [
        ...new Set(
          productIds
            .map((productId) => normalizeProductId(productId))
            .filter(Boolean)
        ),
      ]
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

function findVariantBySelectedOptions(product, selectedOptions) {
  const desiredSignature = normalizeSelectedOptionsSignature(selectedOptions);
  if (!desiredSignature) return null;

  return (
    product.variants.find(
      (variant) => normalizedSelectedOptionsSignature(variant.option_values) === desiredSignature
    ) || null
  );
}

function findVariantByLabel(product, label, aliasContext) {
  const normalizedLabel = normalizeComparisonLabel(label);
  if (!normalizedLabel) return null;

  const candidates = new Set([normalizedLabel]);
  if (aliasContext && aliasContext.flavor) {
    const aliasLabel = normalizeComparisonLabel(`${aliasContext.flavor} / ${label}`);
    if (aliasLabel) candidates.add(aliasLabel);
  }

  for (const variant of product.variants) {
    const variantLabel = normalizeComparisonLabel(
      variant.title || optionLabel(variant.option_values)
    );
    if (candidates.has(variantLabel)) return variant;
  }

  return null;
}

function buildLineFailure({
  index,
  rawItem,
  productId,
  quantity,
  code,
  message,
  selectedOptions,
  variantLabel,
  suppliedVariantId,
}) {
  return {
    input_index: index,
    cart_id: normalizeText(rawItem.id || rawItem.productId || productId || ""),
    requested_product_id: normalizeProductId(rawItem.productId || rawItem.id || ""),
    product_id: productId || null,
    variant_id: suppliedVariantId || null,
    variant: variantLabel || null,
    quantity: Number.isInteger(quantity) ? quantity : null,
    selected_options: selectedOptions || {},
    valid: false,
    code,
    message,
    brand: String(rawItem.brand || "").trim() || null,
    name: String(rawItem.name || "").trim() || null,
    image_url: String(rawItem.image || "").trim() || null,
    currency: String(rawItem.currency || "USD").toUpperCase(),
    unit_amount_cents: 0,
    public_unit_amount_cents: 0,
    regular_unit_amount_cents: 0,
    line_total_cents: 0,
    product_snapshot: null,
  };
}

function buildLineSuccess({
  index,
  rawItem,
  productId,
  product,
  variant,
  quantity,
  variantLabel,
  unitAmountCents,
}) {
  const currency = variant?.currency || product.currency || "USD";
  const lineImageUrl = variant?.image_url || product.image || null;
  return {
    input_index: index,
    cart_id: normalizeText(rawItem.id || rawItem.productId || productId || ""),
    requested_product_id: normalizeProductId(rawItem.productId || rawItem.id || ""),
    product_id: productId,
    variant_id: variant ? variant.variant_id : null,
    variant: variantLabel || null,
    quantity,
    selected_options: variant?.selected_options || {},
    valid: true,
    code: null,
    message: null,
    brand: product.brand,
    name: product.name,
    image_url: lineImageUrl,
    currency,
    unit_amount_cents: unitAmountCents,
    public_unit_amount_cents: variant?.price_cents || product.price_cents,
    regular_unit_amount_cents: variant?.regular_price_cents || product.price_cents,
    line_total_cents: unitAmountCents * quantity,
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
      currency,
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
  };
}

function evaluateCartAgainstIndexes(
  cart,
  activeProductsById,
  activeVariantsByProductAndId,
  options = {}
) {
  const emptyResult = {
    valid: false,
    code: "empty_cart",
    message: "Add at least one product before checkout.",
    items: [],
    lineItems: [],
    invalidItems: [],
    subtotalCents: 0,
    currency: "USD",
  };

  if (!Array.isArray(cart) || cart.length === 0) {
    return emptyResult;
  }

  if (cart.length > MAX_CART_ITEMS) {
    return {
      ...emptyResult,
      code: "cart_too_large",
      message: "Your cart has too many line items.",
    };
  }

  const merged = new Map();
  const lineItems = [];
  let topLevelCode = "";
  let topLevelMessage = "";
  let currency = null;
  let currencyMismatch = false;

  for (let index = 0; index < cart.length; index += 1) {
    const rawItem = cart[index] && typeof cart[index] === "object" ? cart[index] : {};
    const rawProductId = String(rawItem.productId || rawItem.id || "").trim();
    const productId = normalizeProductId(rawProductId);
    const aliasContext = legacyProductAlias(rawProductId);
    const product = activeProductsById.get(productId);
    const quantity = normalizeQuantity(rawItem.quantity);
    const suppliedVariantId = String(rawItem.variant_id || rawItem.variantId || "").trim();
    const selectedOptions = normalizeSelectedOptions(
      rawItem.selectedOptions || rawItem.selected_options
    );
    const mergedSelectedOptions =
      aliasContext && aliasContext.flavor
        ? { Flavor: aliasContext.flavor, ...selectedOptions }
        : selectedOptions;
    const clientVariantLabel = normalizeText(rawItem.variant || "").slice(0, 200);
    const selectedOptionsProvided = Object.keys(mergedSelectedOptions).length > 0;

    if (!product || product.available === false || product.purchasable === false) {
      const failure = buildLineFailure({
        index,
        rawItem,
        productId,
        quantity,
        code: "product_unavailable",
        message: "One of the products in your cart is not ready for checkout.",
        selectedOptions: mergedSelectedOptions,
        variantLabel: clientVariantLabel,
        suppliedVariantId,
      });
      lineItems.push(failure);
      if (!topLevelCode) {
        topLevelCode = failure.code;
        topLevelMessage = failure.message;
      }
      continue;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      const failure = buildLineFailure({
        index,
        rawItem,
        productId,
        quantity,
        code: "invalid_quantity",
        message: "One of the products has an invalid quantity.",
        selectedOptions: mergedSelectedOptions,
        variantLabel: clientVariantLabel,
        suppliedVariantId,
      });
      lineItems.push(failure);
      if (!topLevelCode) {
        topLevelCode = failure.code;
        topLevelMessage = failure.message;
      }
      continue;
    }

    let variant = null;
    let variantResolution = "";

    if (suppliedVariantId) {
      variant = activeVariantsByProductAndId.get(`${productId}::${suppliedVariantId}`) || null;
      variantResolution = variant ? "id" : "";
      if (!variant) {
        const failure = buildLineFailure({
          index,
          rawItem,
          productId,
          quantity,
          code: "variant_unavailable",
          message: "One of the selected product variants is no longer available.",
          selectedOptions: mergedSelectedOptions,
          variantLabel: clientVariantLabel,
          suppliedVariantId,
        });
        lineItems.push(failure);
        if (!topLevelCode) {
          topLevelCode = failure.code;
          topLevelMessage = failure.message;
        }
        continue;
      }

      if (variant.available === false) {
        const failure = buildLineFailure({
          index,
          rawItem,
          productId,
          quantity,
          code: "variant_unavailable",
          message: "One of the selected product variants is no longer available.",
          selectedOptions: mergedSelectedOptions,
          variantLabel: clientVariantLabel,
          suppliedVariantId,
        });
        lineItems.push(failure);
        if (!topLevelCode) {
          topLevelCode = failure.code;
          topLevelMessage = failure.message;
        }
        continue;
      }
    } else {
      if (selectedOptionsProvided) {
        variant = findVariantBySelectedOptions(product, mergedSelectedOptions);
        variantResolution = variant ? "selected_options" : "";
      }

      if (!variant && clientVariantLabel) {
        variant = findVariantByLabel(product, clientVariantLabel, aliasContext);
        variantResolution = variant ? "label" : variantResolution;
      }

      if (!variant) {
        if (product.has_variants) {
          const failure = buildLineFailure({
            index,
            rawItem,
            productId,
            quantity,
            code:
              selectedOptionsProvided || clientVariantLabel
                ? "variant_unavailable"
                : "variant_required",
            message:
              selectedOptionsProvided || clientVariantLabel
                ? "One of the selected product variants is no longer available."
                : "Choose the required product options before checkout.",
            selectedOptions: mergedSelectedOptions,
            variantLabel: clientVariantLabel,
            suppliedVariantId: null,
          });
          lineItems.push(failure);
          if (!topLevelCode) {
            topLevelCode = failure.code;
            topLevelMessage = failure.message;
          }
          continue;
        }

        if (product.requires_variant_selection && !selectedOptionsProvided && !clientVariantLabel) {
          const failure = buildLineFailure({
            index,
            rawItem,
            productId,
            quantity,
            code: "variant_required",
            message: "Choose the required product options before checkout.",
            selectedOptions: mergedSelectedOptions,
            variantLabel: clientVariantLabel,
            suppliedVariantId: null,
          });
          lineItems.push(failure);
          if (!topLevelCode) {
            topLevelCode = failure.code;
            topLevelMessage = failure.message;
          }
          continue;
        }
      }
    }

    if (variant && variant.available === false) {
      const failure = buildLineFailure({
        index,
        rawItem,
        productId,
        quantity,
        code: "variant_unavailable",
        message: "One of the selected product variants is no longer available.",
        selectedOptions: mergedSelectedOptions,
        variantLabel: clientVariantLabel,
        suppliedVariantId: variant.variant_id || null,
      });
      lineItems.push(failure);
      if (!topLevelCode) {
        topLevelCode = failure.code;
        topLevelMessage = failure.message;
      }
      continue;
    }

    const variantLabel = variant
      ? variant.title || optionLabel(variant.option_values)
      : clientVariantLabel ||
        optionLabel(
          Object.keys(mergedSelectedOptions).map((key, index) => ({
            position: index + 1,
            name: key,
            value: mergedSelectedOptions[key],
          }))
        );

    if (
      suppliedVariantId &&
      selectedOptionsProvided &&
      variant &&
      variantResolution === "id" &&
      findVariantBySelectedOptions(product, mergedSelectedOptions) &&
      findVariantBySelectedOptions(product, mergedSelectedOptions).variant_id !== variant.variant_id
    ) {
      const failure = buildLineFailure({
        index,
        rawItem,
        productId,
        quantity,
        code: "invalid_variant",
        message: "One of the selected product variants does not belong to that product.",
        selectedOptions: mergedSelectedOptions,
        variantLabel: clientVariantLabel,
        suppliedVariantId: variant.variant_id,
      });
      lineItems.push(failure);
      if (!topLevelCode) {
        topLevelCode = failure.code;
        topLevelMessage = failure.message;
      }
      continue;
    }

    const unitAmountCents = linePriceCents(product, variant, options);
    if (!unitAmountCents || unitAmountCents <= 0) {
      const failure = buildLineFailure({
        index,
        rawItem,
        productId,
        quantity,
        code: "invalid_variant_price",
        message: "One of the selected product variants has invalid pricing.",
        selectedOptions: mergedSelectedOptions,
        variantLabel,
        suppliedVariantId: variant ? variant.variant_id : null,
      });
      lineItems.push(failure);
      if (!topLevelCode) {
        topLevelCode = failure.code;
        topLevelMessage = failure.message;
      }
      continue;
    }

    const success = buildLineSuccess({
      index,
      rawItem,
      productId,
      product,
      variant,
      quantity,
      variantLabel,
      unitAmountCents,
    });
    lineItems.push(success);

    const mergeKey = `${productId}::${variant ? variant.variant_id : variantLabel}`;
    const existing = merged.get(mergeKey);
    if (existing) {
      existing.quantity += quantity;
      existing.line_total_cents += success.line_total_cents;
    } else {
      merged.set(mergeKey, {
        product_id: success.product_id,
        variant_id: success.variant_id,
        sku: variant?.sku || product.sku || null,
        brand: product.brand,
        name: product.name,
        variant: variantLabel,
        image_url: success.image_url,
        quantity,
        unit_amount_cents: unitAmountCents,
        currency: success.currency,
        public_unit_amount_cents: success.public_unit_amount_cents,
        regular_unit_amount_cents: success.regular_unit_amount_cents,
        product_snapshot: success.product_snapshot,
      });
    }

    if (currency == null) {
      currency = success.currency;
    } else if (currency !== success.currency) {
      currencyMismatch = true;
    }
  }

  const items = Array.from(merged.values());
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount_cents,
    0
  );
  const invalidItems = lineItems.filter((item) => item.valid === false);
  const valid = invalidItems.length === 0 && !currencyMismatch && items.length > 0;
  const currencyValue = currency || "USD";

  return {
    valid,
    code: valid ? "" : topLevelCode || (currencyMismatch ? "mixed_currency" : "invalid_cart"),
    message: valid
      ? ""
      : topLevelMessage ||
        (currencyMismatch
          ? "All cart items must use the same currency."
          : "One or more items in your cart are not ready for checkout."),
    items,
    lineItems,
    invalidItems,
    subtotalCents: currencyMismatch && !invalidItems.length ? subtotalCents : subtotalCents,
    currency: currencyValue,
  };
}

function validateCartAgainstIndexes(
  cart,
  activeProductsById,
  activeVariantsByProductAndId,
  options = {}
) {
  const evaluation = evaluateCartAgainstIndexes(
    cart,
    activeProductsById,
    activeVariantsByProductAndId,
    options
  );

  if (!evaluation.valid) {
    throw validationError(
      evaluation.message || "One or more items in your cart are not ready for checkout.",
      evaluation.code || "invalid_cart"
    );
  }

  return {
    items: evaluation.items,
    subtotalCents: evaluation.subtotalCents,
    currency: evaluation.currency,
  };
}

function validateCart(cart, options = {}) {
  return validateCartAgainstIndexes(
    cart,
    productsById,
    variantsByProductAndId,
    options
  );
}

function evaluateCart(cart, options = {}) {
  return evaluateCartAgainstIndexes(
    cart,
    productsById,
    variantsByProductAndId,
    options
  );
}

async function validateCartWithOverrides(cart, options = {}) {
  const productIds = cartProductIds(cart);
  const overlaidProducts = await loadProductsWithOverrides(productIds, options);
  if (!overlaidProducts.length) {
    return validateCart(cart, options);
  }
  const { products, variants } = buildIndexesFromProducts(overlaidProducts);

  return validateCartAgainstIndexes(cart, products, variants, options);
}

async function evaluateCartWithOverrides(cart, options = {}) {
  const productIds = cartProductIds(cart);
  const overlaidProducts = await loadProductsWithOverrides(productIds, options);
  if (!overlaidProducts.length) {
    return evaluateCart(cart, options);
  }
  const { products, variants } = buildIndexesFromProducts(overlaidProducts);

  return evaluateCartAgainstIndexes(cart, products, variants, options);
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

function cartProductIds(cart) {
  return Array.isArray(cart)
    ? [
        ...new Set(
          cart.map((item) => normalizeProductId(item?.productId || item?.id || "")).filter(Boolean)
        ),
      ]
    : [];
}

module.exports = {
  centsFromMoney,
  evaluateCart,
  evaluateCartWithOverrides,
  getShippingCents,
  loadProductsWithOverrides,
  normalizeAttribution,
  normalizeEmail,
  validateCart,
  validateCartWithOverrides,
};
