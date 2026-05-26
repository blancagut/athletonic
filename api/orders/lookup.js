const { normalizeEmail } = require("../_lib/catalog");
const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../_lib/http");
const { fetchOrderByReferenceAndEmail } = require("../_lib/orders");
const { getSupabaseAdmin } = require("../_lib/supabase");

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const reference = normalizeReference(body.order_reference || body.reference);
    const supabase = getSupabaseAdmin();
    const { order } = await fetchOrderByReferenceAndEmail(supabase, reference, email);

    if (!order) {
      const error = new Error("We could not find an order for that email and reference.");
      error.statusCode = 404;
      error.code = "order_not_found";
      throw error;
    }

    json(res, 200, { order });
  } catch (error) {
    handleError(res, error);
  }
};
