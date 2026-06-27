const { normalizeAttribution, normalizeEmail } = require("../_lib/catalog");
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
const { getStripe } = require("../_lib/stripe");
const { getSupabaseAdmin } = require("../_lib/supabase");

function buildShippingOptions(shippingCents, currency) {
  if (process.env.STRIPE_SHIPPING_RATE_ID) {
    return [{ shipping_rate: process.env.STRIPE_SHIPPING_RATE_ID }];
  }

  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: shippingCents > 0 ? "Standard shipping" : "Free shipping",
        fixed_amount: {
          amount: shippingCents,
          currency: currency.toLowerCase(),
        },
        delivery_estimate: {
          minimum: { unit: "business_day", value: 3 },
          maximum: { unit: "business_day", value: 7 },
        },
      },
    },
  ];
}

function buildLineItems(items, currency) {
  return items.map((item) => {
    const productData = {
      name: item.variant ? `${item.name} - ${item.variant}` : item.name,
      metadata: {
        product_id: item.product_id,
        brand: item.brand,
        section_id: item.section_id || "",
      },
    };

    if (item.image_url && /^https:\/\//i.test(item.image_url)) {
      productData.images = [item.image_url];
    }

    return {
      quantity: item.quantity,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: item.unit_amount_cents,
        product_data: productData,
      },
    };
  });
}

async function buildStripeDiscounts(stripe, pricing, orderId, orderReference) {
  if (pricing.discountCents <= 0) return [];

  const coupon = await stripe.coupons.create(
    {
      amount_off: pricing.discountCents,
      currency: pricing.currency.toLowerCase(),
      duration: "once",
      name: "Access pricing",
      metadata: {
        order_id: orderId,
        order_reference: orderReference,
        pricing_mode: pricing.pricingContext.mode || "private_access",
      },
    },
    {
      idempotencyKey: `checkout-discount-${orderId}`,
    }
  );

  return [{ coupon: coupon.id }];
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
    const stripe = getStripe();
    const siteUrl = getSiteUrl(req);
    const clientIp = getClientIp(req);

    // Authenticated checkout: trust the verified token identity, never the
    // client-supplied email, so a signed-in user cannot apply another
    // account's wholesale pricing by spoofing body.email.
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
    });

    const checkoutCart = pricing.items.map((item) => ({
      id: item.product_id,
      brand: item.brand,
      name: item.name,
      variant: item.variant || null,
      price: item.unit_amount_cents / 100,
      public_price: item.public_unit_amount_cents / 100,
      regular_price: item.regular_unit_amount_cents / 100,
      section_id: item.section_id || null,
      currency: pricing.currency,
      quantity: item.quantity,
    }));

    const { data: checkoutIntent, error: checkoutIntentError } = await supabase
      .from("checkout_intents")
      .insert({
        email: customerEmail,
        cart: checkoutCart,
        subtotal: pricing.subtotalCents / 100,
        discount_cents: pricing.discountCents,
        total: pricing.totalCents / 100,
        pricing_context: pricing.pricingContext,
        currency: pricing.currency,
        status: "new",
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
        p_pricing_context: pricing.pricingContext,
      }
    );

    if (orderError) {
      orderError.statusCode = 500;
      throw orderError;
    }

    const createdOrder = Array.isArray(createdOrderRows)
      ? createdOrderRows[0]
      : createdOrderRows;

    const orderId = createdOrder.order_id;
    const orderReference = createdOrder.order_reference;
    const successUrl = `${siteUrl}/pages/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/?checkout=cancelled&order_reference=${encodeURIComponent(
      orderReference
    )}`;
    const shippingCountries = (process.env.ATHLETONIC_SHIPPING_COUNTRIES || "US")
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean);
    const stripeDiscounts = await buildStripeDiscounts(
      stripe,
      pricing,
      orderId,
      orderReference
    );

    const sessionParams = {
      mode: "payment",
      customer_email: customerEmail,
      client_reference_id: orderReference,
      line_items: buildLineItems(pricing.items, pricing.currency),
      shipping_address_collection: {
        allowed_countries: shippingCountries,
      },
      shipping_options: buildShippingOptions(pricing.shippingCents, pricing.currency),
      automatic_tax: {
        enabled: process.env.STRIPE_AUTOMATIC_TAX === "true",
      },
      allow_promotion_codes:
        stripeDiscounts.length === 0 &&
        process.env.STRIPE_ALLOW_PROMOTION_CODES === "true",
      phone_number_collection: {
        enabled: process.env.STRIPE_COLLECT_PHONE === "true",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        order_id: orderId,
        order_reference: orderReference,
        checkout_intent_id: checkoutIntent.id,
        pricing_mode: pricing.pricingContext.mode || "standard",
        private_pricing_grant_id: pricing.privateGrant ? pricing.privateGrant.id : "",
      },
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          order_reference: orderReference,
          checkout_intent_id: checkoutIntent.id,
          pricing_mode: pricing.pricingContext.mode || "standard",
          private_pricing_grant_id: pricing.privateGrant ? pricing.privateGrant.id : "",
        },
      },
    };
    if (stripeDiscounts.length > 0) sessionParams.discounts = stripeDiscounts;

    const session = await stripe.checkout.sessions.create(
      sessionParams,
      {
        idempotencyKey: `checkout-${orderId}`,
      }
    );

    const { error: updateError } = await supabase
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", orderId);

    if (updateError) {
      updateError.statusCode = 500;
      throw updateError;
    }

    if (pricing.privateGrant) {
      try {
        await recordPrivatePricingUsage(supabase, pricing.privateGrant.id);
      } catch (usageError) {
        console.error("private_pricing_usage_update_failed", usageError);
      }
    }

    json(res, 200, {
      url: session.url,
      session_id: session.id,
      order_id: orderId,
      order_reference: orderReference,
      ...publicQuotePayload(pricing),
    });
  } catch (error) {
    handleError(res, error);
  }
};
