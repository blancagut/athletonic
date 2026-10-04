const crypto = require("crypto");
const { handleError, json, methodNotAllowed, readRawBody, requireEnv } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

function sessionId(value) {
  return typeof value === "string" ? value : value && value.id ? value.id : null;
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const values = String(signatureHeader).split(",").reduce((result, part) => {
    const [key, value] = part.split("=");
    if (key && value) (result[key] || (result[key] = [])).push(value);
    return result;
  }, {});
  const timestamp = values.t && values.t[0];
  const signatures = values.v1 || [];
  if (!timestamp || !signatures.length) throw new Error("Invalid Stripe signature.");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Expired Stripe signature.");
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const matched = signatures.some((value) => {
    const received = Buffer.from(value, "hex");
    const calculated = Buffer.from(expected, "hex");
    return received.length === calculated.length && crypto.timingSafeEqual(received, calculated);
  });
  if (!matched) throw new Error("Invalid Stripe signature.");
}

async function recordEvent(supabase, event, orderId) {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    api_version: event.api_version || null,
    livemode: Boolean(event.livemode),
    order_id: orderId || null,
    payload: event,
    processed_at: new Date().toISOString(),
  });
  return !error || error.code === "23505";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  try {
    requireEnv(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      const error = new Error("Missing Stripe signature.");
      error.statusCode = 400;
      throw error;
    }
    const rawBody = await readRawBody(req);
    verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    const event = JSON.parse(rawBody.toString("utf8"));
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id || null;
    const supabase = getSupabaseAdmin();
    if (!(await recordEvent(supabase, event, orderId))) {
      throw new Error("Could not record Stripe webhook event.");
    }
    if (event.type === "checkout.session.completed" && session.payment_status === "paid" && orderId) {
      const { error } = await supabase.rpc("confirm_order_payment", {
        p_order_id: orderId,
        p_stripe_checkout_session_id: session.id,
        p_stripe_payment_intent_id: sessionId(session.payment_intent),
        p_stripe_customer_id: sessionId(session.customer),
        p_amount_subtotal_cents: session.amount_subtotal,
        p_amount_shipping_cents: session.total_details?.amount_shipping || 0,
        p_amount_tax_cents: session.total_details?.amount_tax || 0,
        p_amount_discount_cents: session.total_details?.amount_discount || 0,
        p_amount_total_cents: session.amount_total,
        p_shipping_method: null,
        p_shipping_address: session.shipping_details?.address || null,
        p_billing_address: session.customer_details?.address || null,
      });
      if (error) throw error;
    }
    if (event.type === "checkout.session.expired" && orderId) {
      const { error } = await supabase.rpc("mark_order_checkout_cancelled", {
        p_order_id: orderId,
        p_stripe_checkout_session_id: session.id,
      });
      if (error) throw error;
    }
    json(res, 200, { received: true });
  } catch (error) {
    handleError(res, error);
  }
};
