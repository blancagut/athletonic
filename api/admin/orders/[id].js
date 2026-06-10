const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");
const { fetchOrderById } = require("../../_lib/orders");

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];
const FULFILLMENT_STATUSES = [
  "not_started",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

// Map a new order_status to the timestamp column it should stamp.
const STATUS_TIMESTAMP = {
  paid: "paid_at",
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
  refunded: "refunded_at",
};

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function cleanText(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max || 240);
}

module.exports = async function handler(req, res) {
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireAdmin(req);

    const orderId = getParam(req, "id");
    if (!orderId) throw validationError("Missing order id.", "missing_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const { order } = await fetchOrderById(supabase, orderId);
      if (!order) {
        const error = new Error("Order not found.");
        error.statusCode = 404;
        error.code = "order_not_found";
        throw error;
      }
      json(res, 200, { order });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const patch = {};
      const eventParts = [];

      if (body.order_status !== undefined) {
        if (!ORDER_STATUSES.includes(body.order_status)) {
          throw validationError("Invalid order status.", "invalid_order_status");
        }
        patch.order_status = body.order_status;
        const tsColumn = STATUS_TIMESTAMP[body.order_status];
        if (tsColumn) patch[tsColumn] = new Date().toISOString();
        eventParts.push(`status:${body.order_status}`);
      }

      if (body.fulfillment_status !== undefined) {
        if (!FULFILLMENT_STATUSES.includes(body.fulfillment_status)) {
          throw validationError("Invalid fulfillment status.", "invalid_fulfillment_status");
        }
        patch.fulfillment_status = body.fulfillment_status;
        eventParts.push(`fulfillment:${body.fulfillment_status}`);
      }

      if (body.tracking_carrier !== undefined) {
        patch.tracking_carrier = cleanText(body.tracking_carrier, 120);
      }
      if (body.tracking_number !== undefined) {
        patch.tracking_number = cleanText(body.tracking_number, 120);
      }
      if (body.tracking_url !== undefined) {
        patch.tracking_url = cleanText(body.tracking_url, 500);
      }

      if (Object.keys(patch).length === 0) {
        throw validationError("No supported fields to update.", "nothing_to_update");
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", orderId);
      if (updateError) throw updateError;

      // Record a status event describing what changed.
      const message = cleanText(body.message, 500) || eventParts.join(" / ") || "Order updated";
      const eventStatus = patch.order_status || patch.fulfillment_status || "updated";
      await supabase.from("order_status_events").insert({
        order_id: orderId,
        status: eventStatus,
        message,
        created_by: ctx.user.email || ctx.profile.email || "admin",
      });

      await logAudit(ctx, "order.update", "order", orderId, patch);

      const { order } = await fetchOrderById(supabase, orderId);
      json(res, 200, { order });
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    handleError(res, error);
  }
};
