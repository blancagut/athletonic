const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");

const DETAIL_SELECT = `
  id,
  email,
  user_id,
  cart,
  subtotal,
  total,
  discount_cents,
  currency,
  status,
  notes,
  created_at,
  updated_at,
  orders (
    order_reference,
    order_status,
    payment_status,
    fulfillment_status,
    total_cents
  )
`;

const INTENT_STATUSES = ["new", "contacted", "converted", "cancelled"];

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

async function fetchIntent(supabase, id) {
  const { data, error } = await supabase
    .from("checkout_intents")
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

    const intentId = getParam(req, "id");
    if (!intentId) throw validationError("Missing checkout intent id.", "missing_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const intent = await fetchIntent(supabase, intentId);
      if (!intent) {
        const error = new Error("Checkout intent not found.");
        error.statusCode = 404;
        error.code = "intent_not_found";
        throw error;
      }
      json(res, 200, { intent });
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const patch = {};

      if (body.status !== undefined) {
        if (!INTENT_STATUSES.includes(body.status)) {
          throw validationError("Invalid intent status.", "invalid_status");
        }
        patch.status = body.status;
      }

      if (body.notes !== undefined) {
        patch.notes = body.notes == null
          ? null
          : String(body.notes).trim().slice(0, 2000);
      }

      if (Object.keys(patch).length === 0) {
        throw validationError("No supported fields to update.", "nothing_to_update");
      }

      const { error: updateError } = await supabase
        .from("checkout_intents")
        .update(patch)
        .eq("id", intentId);
      if (updateError) throw updateError;

      await logAudit(ctx, "checkout_intent.update", "checkout_intent", intentId, patch);

      const intent = await fetchIntent(supabase, intentId);
      json(res, 200, { intent });
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    handleError(res, error);
  }
};
