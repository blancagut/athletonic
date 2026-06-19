const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");

const DETAIL_SELECT = `
  id,
  return_reference,
  order_id,
  customer_email,
  requested_resolution,
  status,
  reason,
  customer_notes,
  admin_notes,
  created_at,
  updated_at,
  return_request_items (
    id,
    order_item_id,
    quantity,
    reason
  ),
  return_request_photos (
    id,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    file_size
  ),
  orders (
    order_reference,
    currency,
    total_cents,
    order_status,
    payment_status,
    fulfillment_status,
    created_at
  )
`;

const RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "received",
  "refunded",
  "replaced",
];

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

async function fetchReturn(supabase, id) {
  const { data, error } = await supabase
    .from("return_requests")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireAdmin(req);

    const returnId = getParam(req, "id");
    if (!returnId) throw validationError("Missing return id.", "missing_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const record = await fetchReturn(supabase, returnId);
      if (!record) {
        const error = new Error("Return request not found.");
        error.statusCode = 404;
        error.code = "return_not_found";
        throw error;
      }
      json(res, 200, { return: record });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const patch = {};
      const existing = await fetchReturn(supabase, returnId);
      if (!existing) {
        const error = new Error("Return request not found.");
        error.statusCode = 404;
        error.code = "return_not_found";
        throw error;
      }

      if (body.status !== undefined) {
        if (!RETURN_STATUSES.includes(body.status)) {
          throw validationError("Invalid return status.", "invalid_status");
        }
        patch.status = body.status;
      }

      if (body.admin_notes !== undefined) {
        patch.admin_notes = body.admin_notes == null
          ? null
          : String(body.admin_notes).trim().slice(0, 2000);
      }

      if (
        patch.status &&
        patch.status !== existing.status &&
        ["approved", "rejected", "refunded", "replaced"].includes(patch.status) &&
        !patch.admin_notes
      ) {
        throw validationError("Add admin notes before approving, rejecting, refunding, or replacing a return.", "missing_admin_notes");
      }

      if (Object.keys(patch).length === 0) {
        throw validationError("No supported fields to update.", "nothing_to_update");
      }

      const { error: updateError } = await supabase
        .from("return_requests")
        .update(patch)
        .eq("id", returnId);
      if (updateError) throw updateError;

      await logAudit(ctx, "return.update", "return_request", returnId, {
        before: { status: existing.status, admin_notes: existing.admin_notes || null },
        patch,
      });

      const record = await fetchReturn(supabase, returnId);
      json(res, 200, { return: record });
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    handleError(res, error);
  }
};
