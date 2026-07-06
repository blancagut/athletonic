"use strict";

const { randomUUID } = require("node:crypto");
const { loadPublishedCatalog } = require("./catalog-source");

const MAX_ORDER_ITEMS = 24;
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
const BANK_DETAILS = {
  companyName: "Athletonic LLC",
  accountNumber: "279027375786136",
  routingNumber: "084009519",
  swiftBic: "TRWIUS35XXX",
  bankName: "Wise US Inc",
  bankAddress: ["108 W 13th St", "Wilmington, DE 19801", "Estados Unidos"],
  companyAddress: ["127 O Higgins Ave", "Missoula, MT 59802", "Estados Unidos"],
  paymentInstructions:
    "Please use the banking information above for USD wire transfers and ACH payments. If you require an invoice or additional payment information, please contact Athletonic LLC before sending funds.",
};

const COLOR_WORDS = [
  "black",
  "white",
  "blue",
  "red",
  "green",
  "yellow",
  "pink",
  "purple",
  "orange",
  "gray",
  "grey",
  "silver",
  "gold",
  "brown",
  "maroon",
  "navy",
  "olive",
  "copper",
  "tan",
  "teal",
  "khaki",
  "mint",
  "burgundy",
  "grafiti",
  "graffiti",
];

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_international_order";
  return error;
}

function clean(value, maxLength = 500) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeText(value) {
  return clean(value, 400)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function email(value) {
  return clean(value, 220).toLowerCase();
}

function moneyCents(value) {
  const cents = Number.parseInt(value, 10);
  return Number.isInteger(cents) && cents > 0 ? cents : null;
}

function productImageUrl(product, variant) {
  const candidates = [
    variant && (variant.image_url || variant.image),
    product && (product.image_url || product.image),
    ...(Array.isArray(product && product.secondary_images) ? product.secondary_images : []),
  ];
  return (
    candidates
      .map((value) => clean(value, 1000))
      .find((value) => /^https?:\/\//i.test(value)) || null
  );
}

function toOptionMap(optionValues) {
  const out = {};
  const values = Array.isArray(optionValues) ? optionValues : [];
  for (const option of values) {
    const name = clean(option && (option.name || option.label), 80);
    const value = clean(option && (option.value || option.selected_value || option.label), 120);
    if (name && value) out[name] = value;
  }
  return out;
}

function variantSelectedOptions(variant) {
  const direct = variant && variant.selected_options && typeof variant.selected_options === "object"
    ? variant.selected_options
    : {};
  const merged = { ...toOptionMap(variant && variant.option_values), ...direct };
  return Object.fromEntries(
    Object.entries(merged)
      .map(([name, value]) => [clean(name, 80), clean(value, 120)])
      .filter(([name, value]) => name && value)
  );
}

function variantSizeValue(variant) {
  const options = variantSelectedOptions(variant);
  return (
    options.Size ||
    options.size ||
    clean(variant && variant.size, 80) ||
    (/^(xxs|xs|s|m|l|xl|xxl|\d+\s?oz)$/i.test(clean(variant && variant.title, 80))
      ? clean(variant && variant.title, 80)
      : "")
  );
}

function variantColorValue(variant, product) {
  const options = variantSelectedOptions(variant);
  return (
    options.Color ||
    options.Colour ||
    options.color ||
    options.colour ||
    clean(variant && variant.color, 80) ||
    extractColor(product)
  );
}

function extractModelCode(product) {
  const haystack = [
    product && product.name,
    product && product.model,
    product && product.sku,
    ...(Array.isArray(product && product.variants) ? product.variants.map((variant) => variant && variant.sku) : []),
  ]
    .filter(Boolean)
    .join(" ");
  const matches = haystack.match(/\b[A-Z]{2,}[A-Z0-9-]*\d(?:[A-Z0-9-]*\d)?(?:-[A-Z0-9]+)*\b/gi) || [];
  if (!matches.length) return null;
  return matches
    .map((value) => value.toUpperCase())
    .sort((a, b) => a.length - b.length)[0];
}

function extractColor(product) {
  const explicit = clean(product && product.color, 120);
  if (explicit) return explicit;
  const name = clean(product && product.name, 220);
  const lower = name.toLowerCase();
  const hits = COLOR_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
  if (hits.length >= 2) return hits.map((value) => value[0].toUpperCase() + value.slice(1)).join(" / ");
  if (hits.length === 1) return hits[0][0].toUpperCase() + hits[0].slice(1);
  const code = extractModelCode(product);
  if (!code) return "";
  const tail = name.split(code).slice(1).join(" ").replace(/^[-/,: ]+/, "").trim();
  return clean(tail, 80);
}

function familyLabel(product) {
  const code = extractModelCode(product);
  const brand = normalizeText(product && product.brand);
  if (code) return `${brand}::${code}`;
  const name = normalizeText(product && product.name)
    .replace(/\b(?:xxs|xs|s|m|l|xl|xxl|black|white|blue|red|green|yellow|pink|purple|orange|gray|grey|silver|gold|brown|maroon|navy|olive|copper)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${brand}::${name}`;
}

const catalog = loadPublishedCatalog();
const catalogProducts = Array.isArray(catalog && catalog.products) ? catalog.products : [];
const productsById = new Map(catalogProducts.map((product) => [String(product && product.id), product]));
const familyMembers = new Map();
for (const product of catalogProducts) {
  const key = familyLabel(product);
  if (!familyMembers.has(key)) familyMembers.set(key, []);
  familyMembers.get(key).push(product);
}

function colorChoicesForProduct(product) {
  const members = familyMembers.get(familyLabel(product)) || [product];
  const byLabel = new Map();
  for (const member of members) {
    const color = clean(extractColor(member), 80);
    if (!color) continue;
    if (byLabel.has(clean(color, 80).toLowerCase())) continue;
    const firstVariant = Array.isArray(member.variants) && member.variants.length ? member.variants[0] : null;
    byLabel.set(clean(color, 80).toLowerCase(), {
      label: color,
      product_id: clean(member.id, 160),
      variant_id: clean(firstVariant && firstVariant.variant_id, 160) || clean(member.default_variant_id, 160) || clean(member.id, 160),
      image_url: productImageUrl(member, firstVariant),
      price_cents: moneyCents(firstVariant && firstVariant.price_cents) || moneyCents(member.price_cents),
      available: firstVariant ? firstVariant.available !== false : member.available !== false,
      selected_options: variantSelectedOptions(firstVariant),
    });
  }
  return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function variantChoicesForProduct(product) {
  const variants = Array.isArray(product && product.variants) ? product.variants : [];
  if (!variants.length) {
    return [{
      variant_id: clean(product && product.default_variant_id, 160) || clean(product && product.id, 160),
      label: "Default",
      size: "",
      color: clean(extractColor(product), 80),
      selected_options: {},
      image_url: productImageUrl(product, null),
      price_cents: moneyCents(product && product.price_cents),
      available: product && product.available !== false,
    }];
  }
  return variants.map((variant) => ({
    variant_id: clean(variant && variant.variant_id, 160),
    label: clean(variant && variant.title, 120) || "Variant",
    size: clean(variantSizeValue(variant), 80),
    color: clean(variantColorValue(variant, product), 80),
    selected_options: variantSelectedOptions(variant),
    image_url: productImageUrl(product, variant),
    price_cents: moneyCents(variant && variant.price_cents) || moneyCents(product && product.price_cents),
    available: variant && variant.available !== false,
  }));
}

function presentProduct(product) {
  if (!product) return null;
  return {
    id: clean(product.id, 160),
    name: clean(product.name, 220),
    brand: clean(product.brand, 120),
    image_url: productImageUrl(product, null),
    price_cents: moneyCents(product.price_cents),
    currency: clean(product.currency, 12) || "USD",
    url: clean(product.url, 1000) || null,
    model_code: extractModelCode(product),
    color_label: clean(extractColor(product), 80),
    variant_choices: variantChoicesForProduct(product),
    color_choices: colorChoicesForProduct(product),
  };
}

function productLookupResponse(productId) {
  const product = productsById.get(clean(productId, 160));
  if (!product) throw validationError("Product not found in the live catalog.", "product_not_found");
  return presentProduct(product);
}

function normalizeReceipt(rawReceipt) {
  if (!rawReceipt || typeof rawReceipt !== "object" || Array.isArray(rawReceipt)) return null;
  const filename = clean(rawReceipt.filename, 180) || "payment-receipt";
  const mimeType = clean(rawReceipt.mime_type || rawReceipt.mimeType, 80);
  const dataBase64 = String(rawReceipt.data_base64 || rawReceipt.dataBase64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!dataBase64) return null;
  if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/i.test(mimeType)) {
    throw validationError("Receipt must be PNG, JPG, WEBP, or PDF.", "invalid_receipt_type");
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length || buffer.length > MAX_RECEIPT_BYTES) {
    throw validationError("Receipt must be smaller than 3 MB.", "receipt_too_large");
  }
  return {
    filename,
    mime_type: mimeType,
    content_base64: buffer.toString("base64"),
    size: buffer.length,
  };
}

function selectedOptionSummary(selectedOptions) {
  return Object.entries(selectedOptions || {})
    .map(([name, value]) => `${name}: ${value}`)
    .join(" / ");
}

function normalizeOrderItem(rawItem) {
  const productId = clean(rawItem && rawItem.product_id, 160);
  const product = productsById.get(productId);
  if (!product) throw validationError("One selected product is no longer available in the catalog.", "unknown_product");

  const variantChoices = variantChoicesForProduct(product);
  const chosenVariantId = clean(rawItem && rawItem.variant_id, 160)
    || clean(product.default_variant_id, 160)
    || (variantChoices[0] && variantChoices[0].variant_id);
  const variantChoice = variantChoices.find((choice) => choice.variant_id === chosenVariantId) || variantChoices[0];
  if (!variantChoice || !variantChoice.variant_id) {
    throw validationError("Choose a valid product variant.", "invalid_variant");
  }

  const colorChoices = colorChoicesForProduct(product);
  const requestedColor = clean(rawItem && rawItem.color, 80);
  let selectedProduct = product;
  let selectedVariant = variantChoice;
  let selectedColor = requestedColor || variantChoice.color || clean(extractColor(product), 80);

  if (requestedColor && colorChoices.length) {
    const colorMatch = colorChoices.find((choice) => normalizeText(choice.label) === normalizeText(requestedColor));
    if (!colorMatch) {
      throw validationError("Choose a valid color from the live catalog.", "invalid_color");
    }
    selectedColor = colorMatch.label;
    if (colorMatch.product_id && colorMatch.product_id !== productId) {
      selectedProduct = productsById.get(colorMatch.product_id) || product;
      const siblingVariants = variantChoicesForProduct(selectedProduct);
      const sameSize = siblingVariants.find((choice) => choice.size && choice.size === variantChoice.size);
      selectedVariant = sameSize || siblingVariants[0] || selectedVariant;
    }
  }

  const quantity = Number.parseInt(rawItem && rawItem.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw validationError("Each line needs a valid quantity.", "invalid_quantity");
  }

  const selectedOptions = {
    ...selectedVariant.selected_options,
  };
  if (selectedVariant.size && !selectedOptions.Size) selectedOptions.Size = selectedVariant.size;
  if (selectedColor && !selectedOptions.Color) selectedOptions.Color = selectedColor;

  const imageUrl = productImageUrl(selectedProduct, selectedVariant);
  const referenceImageNote =
    Boolean(selectedColor) &&
    Boolean(imageUrl) &&
    normalizeText(selectedColor) !== normalizeText(extractColor(selectedProduct));

  const unitPriceCents = moneyCents(selectedVariant.price_cents) || moneyCents(selectedProduct.price_cents);

  return {
    product_id: clean(selectedProduct.id, 160),
    variant_id: clean(selectedVariant.variant_id, 160),
    sku: clean(selectedVariant.sku, 160) || clean(selectedProduct.sku, 160) || null,
    name: clean(selectedProduct.name, 220),
    brand: clean(selectedProduct.brand, 120),
    quantity,
    currency: clean(selectedProduct.currency, 12) || "USD",
    unit_price_cents: unitPriceCents,
    line_subtotal_cents: unitPriceCents ? unitPriceCents * quantity : null,
    image_url: imageUrl,
    product_url: clean(selectedProduct.url, 1000) || null,
    selected_options: selectedOptions,
    variant_label: clean(selectedVariant.label, 120),
    color: clean(selectedColor, 80) || null,
    size: clean(selectedVariant.size, 80) || null,
    reference_image_only: referenceImageNote,
    reference_image_note: referenceImageNote && selectedColor
      ? `Reference image. Selected color: ${selectedColor}.`
      : null,
    price_label: unitPriceCents ? null : "Price confirmed after review",
  };
}

function orderReference() {
  return `AIO-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function normalizeInternationalOrder(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Invalid international order payload.", "invalid_payload");
  }

  const name = clean(body.name, 180);
  const customerEmail = email(body.email);
  const phone = clean(body.phone || body.whatsapp, 80);
  const country = clean(body.country, 120);
  const city = clean(body.city, 120);
  const shippingAddress = clean(body.shipping_address || body.address, 300);
  const notes = clean(body.notes, 1200) || null;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!name) throw validationError("Enter your name.", "missing_name");
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw validationError("Enter a valid email address.", "invalid_email");
  }
  if (!phone) throw validationError("Enter your WhatsApp or phone number.", "missing_phone");
  if (!country) throw validationError("Enter your country.", "missing_country");
  if (!city) throw validationError("Enter your city.", "missing_city");
  if (!shippingAddress) throw validationError("Enter the shipping address.", "missing_shipping_address");
  if (!rawItems.length) throw validationError("Add at least one product line.", "empty_items");
  if (rawItems.length > MAX_ORDER_ITEMS) {
    throw validationError("Too many product lines in one request.", "too_many_items");
  }

  const items = rawItems.map(normalizeOrderItem);
  const subtotalCents = items.reduce((sum, item) => sum + (item.line_subtotal_cents || 0), 0);
  const pricedItemCount = items.filter((item) => Number.isInteger(item.line_subtotal_cents)).length;
  const receipt = normalizeReceipt(body.receipt);

  return {
    id: randomUUID(),
    reference: orderReference(),
    created_at: new Date().toISOString(),
    customer: {
      name,
      email: customerEmail,
      phone,
      country,
      city,
      shipping_address: shippingAddress,
      notes,
    },
    items,
    currency: items[0] && items[0].currency ? items[0].currency : "USD",
    subtotal_cents: pricedItemCount ? subtotalCents : null,
    total_cents: pricedItemCount ? subtotalCents : null,
    priced_item_count: pricedItemCount,
    receipt,
    receipt_uploaded: Boolean(receipt),
  };
}

module.exports = {
  BANK_DETAILS,
  normalizeInternationalOrder,
  presentProduct,
  productLookupResponse,
  selectedOptionSummary,
};
