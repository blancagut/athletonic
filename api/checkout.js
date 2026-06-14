const { getShippingCents, normalizeAttribution, normalizeEmail, validateCart } = require("./_lib/catalog");
const {
  getClientIp,
  getSiteUrl,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  requireEnv,
} = require("./_lib/http");
const { getStripe } = require("./_lib/stripe");
const { getSupabaseAdmin } = require("./_lib/supabase");

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
        variant_id: item.variant_id || "",
        sku: item.sku || "",
        brand: item.brand,
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"]);

    const body = await readJson(req);
    const customerEmail = normalizeEmail(body.email);
    const attribution = normalizeAttribution(body.attribution);
    const { items, subtotalCents, currency } = validateCart(body.cart);
    const shippingCents = getShippingCents(subtotalCents);
    const taxCents = 0;
    const discountCents = 0;
    const totalCents = subtotalCents + shippingCents + taxCents - discountCents;
    const supabase = getSupabaseAdmin();
    const stripe = getStripe();
    const siteUrl = getSiteUrl(req);

    const checkoutCart = items.map((item) => ({
      id: item.product_id,
      variant_id: item.variant_id || null,
      sku: item.sku || null,
      brand: item.brand,
      name: item.name,
      variant: item.variant || null,
      price: item.unit_amount_cents / 100,
      currency,
      quantity: item.quantity,
    }));

    const { data: checkoutIntent, error: checkoutIntentError } = await supabase
      .from("checkout_intents")
      .insert({
        email: customerEmail,
        cart: checkoutCart,
        subtotal: subtotalCents / 100,
        currency,
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
        p_items: items,
        p_subtotal_cents: subtotalCents,
        p_shipping_cents: shippingCents,
        p_tax_cents: taxCents,
        p_discount_cents: discountCents,
        p_currency: currency,
        p_checkout_intent_id: checkoutIntent.id,
        p_customer_ip: getClientIp(req),
        p_user_agent: req.headers["user-agent"] || null,
        p_attribution: attribution,
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

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customerEmail,
        client_reference_id: orderReference,
        line_items: buildLineItems(items, currency),
        shipping_address_collection: {
          allowed_countries: shippingCountries,
        },
        shipping_options: buildShippingOptions(shippingCents, currency),
        automatic_tax: {
          enabled: process.env.STRIPE_AUTOMATIC_TAX === "true",
        },
        allow_promotion_codes: process.env.STRIPE_ALLOW_PROMOTION_CODES === "true",
        phone_number_collection: {
          enabled: process.env.STRIPE_COLLECT_PHONE === "true",
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          order_id: orderId,
          order_reference: orderReference,
          checkout_intent_id: checkoutIntent.id,
        },
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            order_reference: orderReference,
            checkout_intent_id: checkoutIntent.id,
          },
        },
      },
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

    json(res, 200, {
      url: session.url,
      session_id: session.id,
      order_id: orderId,
      order_reference: orderReference,
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      currency,
    });
  } catch (error) {
    handleError(res, error);
  }
};
