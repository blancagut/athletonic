"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { stripHtml, sanitizeQuoteItem } = require("./wholesale-muay-thai");

const PAYMENT_PROOF_BUCKET = "wholesale-order-proofs";
const MAX_PROOF_BYTES = 3 * 1024 * 1024;
const MIN_ORDER_LINE_QTY = 1;

const BANK_DETAILS = {
  company_name: "Athletonic LLC",
  account_number: "279027375786136",
  routing_number: "084009519",
  swift_bic: "TRWIUS35XXX",
  bank_name: "Wise US Inc",
  bank_address: "108 W 13th St\nWilmington, DE 19801\nEstados Unidos",
  company_address: "127 O Higgins Ave\nMissoula, MT 59802\nEstados Unidos",
};

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_order";
  return error;
}

function clean(value, maxLength = 500) {
  return stripHtml(value).trim().slice(0, maxLength);
}

function email(value) {
  return clean(value, 220).toLowerCase();
}

function normalizeAddress(value, required) {
  const address = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = {
    legal_name: clean(address.legal_name, 180),
    tax_id: clean(address.tax_id, 80),
    address_line1: clean(address.address_line1, 220),
    city: clean(address.city, 120),
    region: clean(address.region, 120),
    country: clean(address.country, 120),
    postal_code: clean(address.postal_code, 40),
  };
  if (required) {
    if (!out.address_line1) throw validationError("Complete the address.", "missing_address");
    if (!out.city) throw validationError("Complete the city.", "missing_city");
    if (!out.country) throw validationError("Complete the country.", "missing_country");
  }
  return out;
}

function normalizeSelectedOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => [clean(key, 40), clean(rawValue, 120)])
      .filter(([key, rawValue]) => key && rawValue)
  );
}

function validateSelectedOptions(product, selectedOptions) {
  const cleanOptions = normalizeSelectedOptions(selectedOptions);
  const allowed = new Set([
    ...(Array.isArray(product.sizes) ? product.sizes : []),
    ...(Array.isArray(product.colors) ? product.colors : []),
    ...(Array.isArray(product.other_options) ? product.other_options : []),
  ].map((value) => String(value).toLowerCase()));

  for (const value of Object.values(cleanOptions)) {
    if (allowed.size > 0 && !allowed.has(String(value).toLowerCase())) {
      throw validationError("A selected size, color, or option is not available for that product.", "invalid_selected_options");
    }
  }
  return cleanOptions;
}

function sanitizeManualItem(rawItem) {
  const name = clean(rawItem && rawItem.name, 220);
  if (!name) throw validationError("Each manual line needs a product name.", "missing_manual_product");
  const quantity = Number.parseInt(rawItem && rawItem.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < MIN_ORDER_LINE_QTY || quantity > 999) {
    throw validationError("Each line must have a valid quantity.", "invalid_quantity");
  }
  return {
    product_id: null,
    custom: true,
    brand: clean(rawItem.brand, 120) || "Por confirmar",
    name,
    category_label: clean(rawItem.category_label || rawItem.category, 120) || "Pedido manual",
    product_type: clean(rawItem.product_type || rawItem.category_label || rawItem.category, 120) || "Pedido manual",
    image_url: null,
    url: null,
    selected_options: normalizeSelectedOptions(rawItem.selected_options),
    quantity,
    notes: clean(rawItem.notes, 300) || null,
    availability_status: "Requested",
    unit_price_cents: null,
    retail_price_cents: null,
    wholesale_price_cents: null,
    wholesale_discount_bps: null,
  };
}

function sanitizeOrderItem(rawItem, productsById) {
  const productId = clean(rawItem && (rawItem.product_id || rawItem.id), 120);
  if (!productId || rawItem.custom) return sanitizeManualItem(rawItem || {});
  const product = productsById.get(productId);
  if (!product) throw validationError("One of the products is not available in the catalog.", "unknown_product");
  const quantity = Number.parseInt(rawItem.quantity, 10);
  if (!Number.isInteger(quantity) || quantity < MIN_ORDER_LINE_QTY || quantity > 999) {
    throw validationError("Each line must have a valid quantity.", "invalid_quantity");
  }
  const sanitized = sanitizeQuoteItem(
    {
      ...rawItem,
      quantity,
      selected_options: validateSelectedOptions(product, rawItem.selected_options),
    },
    product
  );
  sanitized.unit_price_cents =
    Number.isInteger(sanitized.retail_price_cents) && sanitized.retail_price_cents > 0
      ? sanitized.retail_price_cents
      : null;
  sanitized.wholesale_price_cents = null;
  sanitized.wholesale_discount_bps = null;
  return sanitized;
}

function normalizePaymentProof(value) {
  const proof = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const filename = clean(proof.filename, 180) || "comprobante";
  const mimeType = clean(proof.mime_type || proof.mimeType, 80);
  const dataBase64 = String(proof.data_base64 || proof.dataBase64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!dataBase64) throw validationError("Upload the payment proof.", "missing_payment_proof");
  if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/i.test(mimeType)) {
    throw validationError("Payment proof must be PNG, JPG, WEBP, or PDF.", "invalid_payment_proof_type");
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length || buffer.length > MAX_PROOF_BYTES) {
    throw validationError("Payment proof must be smaller than 3 MB.", "payment_proof_too_large");
  }
  return { filename, mime_type: mimeType, buffer, size: buffer.length };
}

function normalizeOrderRequestBody(body, productsById) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Invalid order payload.", "invalid_payload");
  }

  const name = clean(body.name, 180);
  const companyName = clean(body.company_name, 180);
  const customerEmail = email(body.email);
  const whatsapp = clean(body.whatsapp, 80);
  const country = clean(body.country, 120);
  const notes = clean(body.notes, 1200);
  const paymentMethod = clean(body.payment_method, 40) || "bank_transfer";
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!name) throw validationError("Enter your name.", "missing_name");
  if (!companyName) throw validationError("Enter the company name.", "missing_company_name");
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw validationError("Enter a valid invoice email.", "invalid_email");
  }
  if (!whatsapp) throw validationError("Enter your WhatsApp number.", "missing_whatsapp");
  if (!country) throw validationError("Enter the delivery country.", "missing_country");
  if (!["bank_transfer", "cash_deposit"].includes(paymentMethod)) {
    throw validationError("Select a valid payment method.", "invalid_payment_method");
  }
  if (!rawItems.length) throw validationError("Add at least one product.", "empty_items");

  const billing = normalizeAddress(body.billing, true);
  billing.legal_name = billing.legal_name || companyName;
  const shipping = normalizeAddress(body.shipping, true);
  const items = rawItems.map((rawItem) => sanitizeOrderItem(rawItem, productsById));
  const quantityCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (!quantityCount) throw validationError("Add valid quantities.", "empty_items");

  const estimatedTotalCents = items.reduce((sum, item) => {
    const unit = Number(item.unit_price_cents || item.retail_price_cents);
    return Number.isInteger(unit) && unit > 0 ? sum + unit * Number(item.quantity || 0) : sum;
  }, 0);

  return {
    id: randomUUID(),
    name,
    company_name: companyName,
    email: customerEmail,
    whatsapp,
    country,
    notes: notes || null,
    billing,
    shipping,
    payment_method: paymentMethod,
    payment_proof: normalizePaymentProof(body.payment_proof),
    items,
    item_count: items.length,
    quantity_count: quantityCount,
    estimated_total_cents: estimatedTotalCents,
    has_quote_only: items.some((item) => !(item.unit_price_cents || item.retail_price_cents)),
    source_page: clean(body.source_page || "/order", 300) || "/order",
  };
}

async function ensurePaymentProofBucket(supabase) {
  const existing = await supabase.storage.getBucket(PAYMENT_PROOF_BUCKET);
  if (!existing.error) return;
  const created = await supabase.storage.createBucket(PAYMENT_PROOF_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PROOF_BYTES,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  });
  if (created.error && !/already exists/i.test(created.error.message || "")) throw created.error;
}

function safeProofFilename(filename, mimeType) {
  const extFromMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  }[mimeType] || "";
  const parsed = path.parse(filename || "comprobante");
  const base = clean(parsed.name, 80).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "comprobante";
  const ext = parsed.ext && parsed.ext.length <= 8 ? parsed.ext.toLowerCase() : extFromMime;
  return `${base}${ext || extFromMime}`;
}

async function uploadPaymentProof(supabase, orderId, proof) {
  await ensurePaymentProofBucket(supabase);
  const filename = safeProofFilename(proof.filename, proof.mime_type);
  const storagePath = `${orderId}/${filename}`;
  const { error } = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(storagePath, proof.buffer, {
      contentType: proof.mime_type,
      upsert: false,
    });
  if (error) throw error;
  return {
    bucket: PAYMENT_PROOF_BUCKET,
    path: storagePath,
    filename,
    mime_type: proof.mime_type,
    size: proof.size,
  };
}

module.exports = {
  BANK_DETAILS,
  MIN_ORDER_LINE_QTY,
  PAYMENT_PROOF_BUCKET,
  normalizeOrderRequestBody,
  uploadPaymentProof,
};
