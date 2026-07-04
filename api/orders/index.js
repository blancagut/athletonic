const { getAuthedUser } = require("../_lib/auth");
const { normalizeEmail } = require("../_lib/validation");
const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { fetchOrdersForCustomer } = require("../_lib/orders");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

    const user = await getAuthedUser(req);
    const email = normalizeEmail(user.email);
    const supabase = getSupabaseAdmin();
    const { orders, error } = await fetchOrdersForCustomer(supabase, {
      userId: user.id,
      email,
      limit: 12,
    });
    if (error) throw error;

    json(res, 200, { orders });
  } catch (error) {
    handleError(res, error);
  }
};
