const crypto = require("node:crypto");
const { normalizeEmail } = require("../_lib/validation");
const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../_lib/http");
const { fetchOrderByReferenceAndEmail } = require("../_lib/orders");
const { getSupabaseAdmin } = require("../_lib/supabase");

const RETURNABLE_STATUSES = new Set(["paid", "processing", "shipped", "delivered"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function normalizeReference(reference) {
  const normalized = String(reference || "").trim().toUpperCase();
  if (!/^ATH-[A-Z0-9]{10}$/.test(normalized)) {
    const error = new Error("Enter a valid Athletonic order reference.");
    error.statusCode = 400;
    error.code = "invalid_reference";
    throw error;
  }
  return normalized;
}

function normalizeResolution(value) {
  const normalized = String(value || "refund").trim().toLowerCase();
  if (!["refund", "replacement"].includes(normalized)) {
    const error = new Error("Choose refund or replacement.");
    error.statusCode = 400;
    error.code = "invalid_resolution";
    throw error;
  }
  return normalized;
}

function normalizeReason(value) {
  const reason = String(value || "").trim();
  if (reason.length < 4 || reason.length > 500) {
    const error = new Error("Add a clear return reason.");
    error.statusCode = 400;
    error.code = "invalid_reason";
    throw error;
  }
  return reason;
}

function normalizeItems(rawItems, order) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) {
    const error = new Error("Choose at least one item from the order.");
    error.statusCode = 400;
    error.code = "missing_items";
    throw error;
  }

  const orderItemsById = new Map(order.items.map((item) => [item.id, item]));

  return items.map((item) => {
    const orderItemId = String(item.order_item_id || item.item_id || "").trim();
    const orderItem = orderItemsById.get(orderItemId);
    if (!orderItem) {
      const error = new Error("One selected item does not belong to this order.");
      error.statusCode = 400;
      error.code = "invalid_item";
      throw error;
    }

    const quantity = Number.parseInt(item.quantity || "1", 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > orderItem.quantity) {
      const error = new Error("One selected item has an invalid quantity.");
      error.statusCode = 400;
      error.code = "invalid_quantity";
      throw error;
    }

    return {
      order_item_id: orderItemId,
      quantity,
      reason: String(item.reason || "").trim().slice(0, 500) || null,
    };
  });
}

function decodePhoto(photo) {
  const filename = String(photo.name || "return-photo").replace(/[^\w.-]/g, "_").slice(0, 120);
  const mimeType = String(photo.type || "").toLowerCase();
  const value = String(photo.data || "");
  const base64 = value.includes(",") ? value.split(",").pop() : value;
  const buffer = Buffer.from(base64, "base64");

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    const error = new Error("Photos must be JPG, PNG, or WebP.");
    error.statusCode = 400;
    error.code = "invalid_photo_type";
    throw error;
  }

  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    const error = new Error("Each photo must be under 2 MB.");
    error.statusCode = 400;
    error.code = "invalid_photo_size";
    throw error;
  }

  return { filename, mimeType, buffer };
}

async function uploadPhotos(supabase, returnRequestId, photos) {
  const photoRows = [];
  const requestedPhotos = Array.isArray(photos) ? photos.slice(0, MAX_PHOTOS) : [];

  for (const photo of requestedPhotos) {
    const decoded = decodePhoto(photo);
    const extension = decoded.mimeType.split("/")[1].replace("jpeg", "jpg");
    const storagePath = `${returnRequestId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("return-photos")
      .upload(storagePath, decoded.buffer, {
        contentType: decoded.mimeType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    photoRows.push({
      return_request_id: returnRequestId,
      storage_bucket: "return-photos",
      storage_path: storagePath,
      original_filename: decoded.filename,
      mime_type: decoded.mimeType,
      file_size: decoded.buffer.length,
    });
  }

  if (photoRows.length > 0) {
    const { error } = await supabase.from("return_request_photos").insert(photoRows);
    if (error) throw error;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

    const body = await readJson(req, 7 * 1024 * 1024);
    const email = normalizeEmail(body.email);
    const reference = normalizeReference(body.order_reference || body.reference);
    const reason = normalizeReason(body.reason);
    const requestedResolution = normalizeResolution(body.requested_resolution || body.resolution);
    const notes = String(body.notes || "").trim().slice(0, 1500) || null;
    const supabase = getSupabaseAdmin();
    const { order } = await fetchOrderByReferenceAndEmail(supabase, reference, email);

    if (!order) {
      const error = new Error("We could not find an order for that email and reference.");
      error.statusCode = 404;
      error.code = "order_not_found";
      throw error;
    }

    if (!RETURNABLE_STATUSES.has(order.order_status)) {
      const error = new Error("This order is not eligible for a return request.");
      error.statusCode = 409;
      error.code = "order_not_returnable";
      throw error;
    }

    const items = normalizeItems(body.items, order);
    const { data: returnReference, error: referenceError } = await supabase.rpc(
      "generate_order_reference",
      { p_prefix: "RET" }
    );

    if (referenceError) throw referenceError;

    const { data: returnRequest, error: returnError } = await supabase
      .from("return_requests")
      .insert({
        return_reference: returnReference,
        order_id: order.id,
        customer_email: email,
        requested_resolution: requestedResolution,
        status: "requested",
        reason,
        customer_notes: notes,
      })
      .select("id, return_reference, status, created_at")
      .single();

    if (returnError) throw returnError;

    const { error: itemError } = await supabase.from("return_request_items").insert(
      items.map((item) => ({
        return_request_id: returnRequest.id,
        order_item_id: item.order_item_id,
        quantity: item.quantity,
        reason: item.reason || reason,
      }))
    );

    if (itemError) throw itemError;

    await uploadPhotos(supabase, returnRequest.id, body.photos);

    json(res, 200, {
      return_request: returnRequest,
      message: "Return request received.",
    });
  } catch (error) {
    handleError(res, error);
  }
};
