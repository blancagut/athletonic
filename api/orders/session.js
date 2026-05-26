const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { fetchOrderById, fetchOrderBySession } = require("../_lib/orders");
const { getStripe } = require("../_lib/stripe");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"]);

    const url = new URL(req.url, `https://${req.headers.host}`);
    const sessionId = String(url.searchParams.get("session_id") || "").trim();
    if (!/^cs_(test|live)_/.test(sessionId)) {
      const error = new Error("Missing or invalid Stripe session id.");
      error.statusCode = 400;
      error.code = "invalid_session";
      throw error;
    }

    const supabase = getSupabaseAdmin();
    let { order } = await fetchOrderBySession(supabase, sessionId);
    let stripe_payment_status = null;

    if (!order) {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      stripe_payment_status = session.payment_status || null;
      if (session.metadata?.order_id) {
        const result = await fetchOrderById(supabase, session.metadata.order_id);
        order = result.order;
      }
    }

    if (!order) {
      const error = new Error("Order not found yet.");
      error.statusCode = 404;
      error.code = "order_not_found";
      throw error;
    }

    json(res, 200, {
      order,
      stripe_payment_status,
    });
  } catch (error) {
    handleError(res, error);
  }
};
