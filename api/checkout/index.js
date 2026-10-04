const { normalizeAttribution, normalizeEmail } = require("../_lib/validation");
const { buildCheckoutPricing, publicQuotePayload } = require("../_lib/checkout-pricing");
const { getOptionalAuthedUser } = require("../_lib/auth");
const {
  getClientIp,
  getSiteUrl,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  requireEnv,
} = require("../_lib/http");
const {
  accessCodeProvided,
  recordPrivatePricingUsage,
} = require("../_lib/private-pricing");
const { getSupabaseAdmin } = require("../_lib/supabase");

const SHIPPING_COUNTRIES = [
  "AR", "AU", "AT", "BE", "BO", "BR", "CA", "CL", "CO", "CR", "CZ", "DK",
  "DO", "EC", "SV", "FI", "FR", "DE", "GR", "GT", "HN", "HK", "HU", "IE",
  "IL", "IT", "JP", "LU", "MY", "MX", "NL", "NZ", "NI", "NO", "PA", "PY",
  "PE", "PH", "PL", "PT", "PR", "RO", "SG", "SK", "SI", "ES", "SE", "CH",
  "TH", "GB", "US", "UY", "VE",
];

function buildCheckoutCart(pricing) {
  return pricing.items.map((item) => ({
    id: item.product_id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    sku: item.sku || null,
    brand: item.brand,
    name: item.name,
    variant: item.variant || null,
    selected_options: item.product_snapshot?.selected_options || {},
    url: item.product_snapshot?.url || null,
    image_url: item.image_url || item.product_snapshot?.image_url || null,
    price: item.unit_amount_cents / 100,
    public_price: item.public_unit_amount_cents / 100,
    regular_price: item.regular_unit_amount_cents / 100,
    unit_amount_cents: item.unit_amount_cents,
    public_price_cents: item.public_unit_amount_cents,
    regular_price_cents: item.regular_unit_amount_cents,
    discount: pricing.lineDiscounts.find((line) =>
      line.product_id === item.product_id &&
      (line.variant_id || null) === (item.variant_id || null)
    ) || null,
    section_id: item.section_id || null,
    currency: pricing.currency,
    quantity: item.quantity,
  }));
}

function buildOrderItems(pricing) {
  return pricing.items.map((item) => {
    const discount = pricing.lineDiscounts.find((line) =>
      line.product_id === item.product_id &&
      (line.variant_id || null) === (item.variant_id || null)
    ) || null;
    return {
      product_id: item.product_id,
      sku: item.sku || null,
      brand: item.brand,
      name: item.name,
      variant: item.variant || null,
      image_url: item.image_url || null,
      quantity: item.quantity,
      unit_amount_cents: item.unit_amount_cents,
      line_subtotal_cents: item.quantity * item.unit_amount_cents,
      currency: pricing.currency,
      product_snapshot: {
        ...(item.product_snapshot || {}),
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        sku: item.sku || null,
        selected_options: item.product_snapshot?.selected_options || {},
        unit_amount_cents: item.unit_amount_cents,
        public_unit_amount_cents: item.public_unit_amount_cents,
        regular_unit_amount_cents: item.regular_unit_amount_cents,
        discount,
        currency: pricing.currency,
      },
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJson(req);
    const hasAccessCode = accessCodeProvided(body.access_code);
    requireEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      ...(hasAccessCode ? ["ATHLETONIC_PRIVATE_PRICING_SECRET"] : []),
    ]);

    const attribution = normalizeAttribution(body.attribution);
    const supabase = getSupabaseAdmin();
    const siteUrl = getSiteUrl(req);
    const clientIp = getClientIp(req);

    const authedUser = await getOptionalAuthedUser(req);
    const customerEmail = authedUser
      ? normalizeEmail(authedUser.email)
      : normalizeEmail(body.email);

    const pricing = await buildCheckoutPricing({
      supabase,
      email: customerEmail,
      cart: body.cart,
      accessCode: body.access_code,
      clientIp,
      authUserId: authedUser ? authedUser.id : null,
      allowManualOrder: false,
    });

    const checkoutCart = buildCheckoutCart(pricing);
    const { data: checkoutIntent, error: checkoutIntentError } = await supabase
      .from("checkout_intents")
      .insert({
        email: customerEmail,
        user_id: authedUser ? authedUser.id : null,
        cart: checkoutCart,
        subtotal: pricing.subtotalCents / 100,
        discount_cents: pricing.discountCents,
        total: pricing.totalCents / 100,
        pricing_context: {
          ...pricing.pricingContext,
          payment_method: "stripe",
        },
        currency: pricing.currency,
        status: "new",
        notes: "Stripe Checkout session pending.",
      })
      .select("id")
      .single();

    if (checkoutIntentError) {
      checkoutIntentError.statusCode = 500;
      throw checkoutIntentError;
    }

    const { data: createdOrderRows, error: orderError } = await supabase.rpc(
      "create_pending_order",
      {
        p_customer_email: customerEmail,
        p_items: pricing.items,
        p_subtotal_cents: pricing.subtotalCents,
        p_shipping_cents: pricing.shippingCents,
        p_tax_cents: pricing.taxCents,
        p_discount_cents: pricing.discountCents,
        p_currency: pricing.currency,
        p_checkout_intent_id: checkoutIntent.id,
        p_customer_ip: clientIp,
        p_user_agent: req.headers["user-agent"] || null,
        p_attribution: attribution,
        p_private_pricing_grant_id: pricing.privateGrant ? pricing.privateGrant.id : null,
        p_pricing_context: {
          ...pricing.pricingContext,
          payment_method: "stripe",
        },
      }
    );

    if (orderError) {
      orderError.statusCode = 500;
      throw orderError;
    }

    const createdOrder = Array.isArray(createdOrderRows)
      ? createdOrderRows[0]
      : createdOrderRows;
    if (authedUser && createdOrder && createdOrder.order_id) {
      const { error: orderOwnerError } = await supabase
        .from("orders")
        .update({ user_id: authedUser.id })
        .eq("id", createdOrder.order_id);
      if (orderOwnerError) {
        orderOwnerError.statusCode = 500;
        throw orderOwnerError;
      }
    }
    if (pricing.privateGrant) {
      try {
        await recordPrivatePricingUsage(supabase, pricing.privateGrant.id);
      } catch (usageError) {
        console.error("private_pricing_usage_update_failed", usageError);
      }
    }

    const form = new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "card",
      customer_email: customerEmail,
      billing_address_collection: "required",
      client_reference_id: createdOrder.order_id,
      "metadata[order_id]": createdOrder.order_id,
      "metadata[order_reference]": createdOrder.order_reference,
      success_url: `${siteUrl}/pages/order-confirmation.html?transfer=1&order_reference=${encodeURIComponent(createdOrder.order_reference)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled&order_reference=${encodeURIComponent(createdOrder.order_reference)}`,
    });
    SHIPPING_COUNTRIES.forEach((country, index) => {
      form.set(`shipping_address_collection[allowed_countries][${index}]`, country);
    });
    pricing.items.forEach((item, index) => {
      const prefix = `line_items[${index}]`;
      form.set(`${prefix}[price_data][currency]`, pricing.currency.toLowerCase());
      form.set(`${prefix}[price_data][product_data][name]`, item.variant ? `${item.name} — ${item.variant}` : item.name);
      form.set(`${prefix}[price_data][unit_amount]`, String(item.unit_amount_cents));
      form.set(`${prefix}[quantity]`, String(item.quantity));
    });
    let extraLineIndex = pricing.items.length;
    for (const [name, cents] of [["Shipping", pricing.shippingCents], ["Tax", pricing.taxCents]]) {
      if (cents <= 0) continue;
      const prefix = `line_items[${extraLineIndex++}]`;
      form.set(`${prefix}[price_data][currency]`, pricing.currency.toLowerCase());
      form.set(`${prefix}[price_data][product_data][name]`, name);
      form.set(`${prefix}[price_data][unit_amount]`, String(cents));
      form.set(`${prefix}[quantity]`, "1");
    }
    if (pricing.discountCents > 0) {
      const couponForm = new URLSearchParams({
        duration: "once",
        amount_off: String(pricing.discountCents),
        currency: pricing.currency.toLowerCase(),
        max_redemptions: "1",
        name: pricing.kitDiscountCents === pricing.discountCents ? "Kit Lab 10%" : "Athletonic savings",
        "metadata[order_id]": createdOrder.order_id,
      });
      const couponResponse = await fetch("https://api.stripe.com/v1/coupons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: couponForm,
      });
      const coupon = await couponResponse.json();
      if (!couponResponse.ok || !coupon.id) {
        const error = new Error(coupon?.error?.message || "Could not apply the kit discount.");
        error.statusCode = 502;
        throw error;
      }
      form.set("discounts[0][coupon]", coupon.id);
    }
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      const error = new Error(session?.error?.message || "Could not create Stripe Checkout.");
      error.statusCode = 502;
      throw error;
    }

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    if (Number.isInteger(session.amount_total) && session.amount_total !== pricing.totalCents) {
      const error = new Error("Checkout total did not match the verified kit price.");
      error.statusCode = 502;
      throw error;
    }
    const { error: sessionSaveError } = await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", createdOrder.order_id);
    if (sessionSaveError) throw sessionSaveError;

    json(res, 200, {
      ok: true,
      url: session.url,
      order_id: createdOrder.order_id,
      order_reference: createdOrder.order_reference,
      payment_method: "stripe",
      ...publicQuotePayload(pricing),
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports.buildCheckoutCart = buildCheckoutCart;
module.exports.buildOrderItems = buildOrderItems;
