const catalog = require("../../data/athletonic-catalog.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CART_ITEMS = 40;
const MAX_ITEM_QUANTITY = 20;

const productsById = new Map(
  catalog.products.map((product) => [String(product.id), product])
);

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

function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    const error = new Error("Add at least one product before checkout.");
    error.statusCode = 400;
    error.code = "empty_cart";
    throw error;
  }

  if (cart.length > MAX_CART_ITEMS) {
    const error = new Error("Your cart has too many line items.");
    error.statusCode = 400;
    error.code = "cart_too_large";
    throw error;
  }

  const normalized = [];
  const merged = new Map();

  for (const rawItem of cart) {
    const productId = String(rawItem.productId || rawItem.id || "").split("::")[0];
    const product = productsById.get(productId);

    if (!product || product.available === false) {
      const error = new Error("One of the products in your cart is no longer available.");
      error.statusCode = 400;
      error.code = "product_unavailable";
      throw error;
    }

    const quantity = Number.parseInt(rawItem.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      const error = new Error("One of the products has an invalid quantity.");
      error.statusCode = 400;
      error.code = "invalid_quantity";
      throw error;
    }

    const variant = String(rawItem.variant || "").trim().slice(0, 160);
    const mergeKey = `${productId}::${variant}`;
    const existing = merged.get(mergeKey);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > MAX_ITEM_QUANTITY) {
        const error = new Error("One of the products has an invalid quantity.");
        error.statusCode = 400;
        error.code = "invalid_quantity";
        throw error;
      }
      continue;
    }

    merged.set(mergeKey, {
      product_id: productId,
      sku: product.sku || null,
      brand: product.brand,
      name: product.name,
      variant,
      image_url: product.image || null,
      quantity,
      unit_amount_cents: product.price_cents,
      currency: product.currency || "USD",
      product_snapshot: {
        id: productId,
        brand_slug: product.brand_slug,
        brand: product.brand,
        name: product.name,
        url: product.url || null,
        image: product.image || null,
        price_cents: product.price_cents,
        currency: product.currency || "USD",
      },
    });
  }

  for (const item of merged.values()) {
    normalized.push(item);
  }

  const currency = normalized[0].currency || "USD";
  if (normalized.some((item) => item.currency !== currency)) {
    const error = new Error("All cart items must use the same currency.");
    error.statusCode = 400;
    error.code = "mixed_currency";
    throw error;
  }

  const subtotalCents = normalized.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount_cents,
    0
  );

  return { items: normalized, subtotalCents, currency };
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
  normalizeAttribution,
  normalizeEmail,
  validateCart,
};
