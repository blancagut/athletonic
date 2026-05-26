const { handleError, json, methodNotAllowed, readRawBody, requireEnv } = require("./_lib/http");
const { getStripe } = require("./_lib/stripe");
const { getSupabaseAdmin } = require("./_lib/supabase");

function addressFromStripe(address) {
  if (!address) return null;
  return {
    line1: address.line1 || null,
    line2: address.line2 || null,
    city: address.city || null,
    state: address.state || null,
    postal_code: address.postal_code || null,
    country: address.country || null,
  };
}

function paymentIntentId(paymentIntent) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id || null;
}

async function recordWebhookStart(supabase, event) {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    type: event.type,
    api_version: event.api_version || null,
    livemode: Boolean(event.livemode),
    payload: event,
  });

  if (error && error.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function recordWebhookResult(supabase, eventId, values) {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed_at: values.error ? null : new Date().toISOString(),
      error: values.error || null,
      order_id: values.order_id || null,
    })
    .eq("id", eventId);

  if (error) throw error;
}

async function handleCheckoutPaid(supabase, stripe, sessionLike) {
  const session = await stripe.checkout.sessions.retrieve(sessionLike.id, {
    expand: ["payment_intent", "customer"],
  });

  if (session.payment_status !== "paid") {
    return { order_id: session.metadata?.order_id || null };
  }

  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error("Stripe session is missing order_id metadata.");

  const shippingDetails = session.shipping_details || {};
  const shippingAddress = addressFromStripe(shippingDetails.address);
  const billingAddress = addressFromStripe(session.customer_details?.address);
  const shippingMethod =
    session.shipping_cost?.shipping_rate ||
    shippingDetails.name ||
    null;

  const { error } = await supabase.rpc("confirm_order_payment", {
    p_order_id: orderId,
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId(session.payment_intent),
    p_stripe_customer_id:
      typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    p_amount_subtotal_cents: session.amount_subtotal || 0,
    p_amount_shipping_cents: session.total_details?.amount_shipping || 0,
    p_amount_tax_cents: session.total_details?.amount_tax || 0,
    p_amount_discount_cents: session.total_details?.amount_discount || 0,
    p_amount_total_cents: session.amount_total || 0,
    p_shipping_method: shippingMethod,
    p_shipping_address: shippingAddress,
    p_billing_address: billingAddress,
  });

  if (error) throw error;
  return { order_id: orderId };
}

async function handleCheckoutExpired(supabase, session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return { order_id: null };

  const { error } = await supabase.rpc("mark_order_checkout_cancelled", {
    p_order_id: orderId,
    p_stripe_checkout_session_id: session.id,
  });

  if (error) throw error;
  return { order_id: orderId };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);

    const stripe = getStripe();
    const supabase = getSupabaseAdmin();
    const signature = req.headers["stripe-signature"];
    const rawBody = await readRawBody(req, 1024 * 1024 * 2);
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      json(res, 400, { error: "invalid_signature" });
      return;
    }

    const shouldProcess = await recordWebhookStart(supabase, event);
    if (!shouldProcess) {
      json(res, 200, { received: true, duplicate: true });
      return;
    }

    try {
      let result = {};
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        result = await handleCheckoutPaid(supabase, stripe, event.data.object);
      } else if (event.type === "checkout.session.expired") {
        result = await handleCheckoutExpired(supabase, event.data.object);
      }

      await recordWebhookResult(supabase, event.id, result);
      json(res, 200, { received: true });
    } catch (error) {
      await recordWebhookResult(supabase, event.id, { error: error.message });
      throw error;
    }
  } catch (error) {
    handleError(res, error);
  }
};
