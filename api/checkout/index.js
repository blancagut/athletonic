const { normalizeAttribution, normalizeEmail } = require("../_lib/validation");
const { buildCheckoutPricing, publicQuotePayload } = require("../_lib/checkout-pricing");
const { getOptionalAuthedUser } = require("../_lib/auth");
const {
  sendBankTransferOrderCustomerEmail,
  sendBankTransferOrderSalesEmail,
} = require("../_lib/email");
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

function getSalesEmail() {
  return process.env.ATHLETONIC_SALES_EMAIL || "orders@athletonic.com";
}

function buildCheckoutCart(pricing) {
  return pricing.items.map((item) => ({
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
}

function buildOrderItems(pricing) {
  return pricing.items.map((item) => ({
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
    product_snapshot: item.product_snapshot || {},
  }));
}

function buildTransferOrder({ createdOrder, customerEmail, pricing }) {
  const createdAt = new Date().toISOString();
  return {
    id: createdOrder.order_id,
    order_reference: createdOrder.order_reference,
    customer_email: customerEmail,
    currency: pricing.currency,
    payment_method: "bank_transfer",
    payment_status: "pending",
    order_status: "pending_payment",
    fulfillment_status: "not_started",
    amounts: {
      subtotal_cents: pricing.subtotalCents,
      shipping_cents: pricing.shippingCents,
      tax_cents: pricing.taxCents,
      discount_cents: pricing.discountCents,
      total_cents: pricing.totalCents,
    },
    timestamps: {
      created_at: createdAt,
    },
    items: buildOrderItems(pricing),
  };
}

function publicOrderPayload(order) {
  return {
    order_reference: order.order_reference,
    customer_email: order.customer_email,
    currency: order.currency,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    order_status: order.order_status,
    fulfillment_status: order.fulfillment_status,
    amounts: order.amounts,
    timestamps: order.timestamps,
    items: order.items.map((item) => ({
      product_id: item.product_id,
      sku: item.sku,
      brand: item.brand,
      name: item.name,
      variant: item.variant,
      image_url: item.image_url,
      quantity: item.quantity,
      unit_amount_cents: item.unit_amount_cents,
      line_subtotal_cents: item.line_subtotal_cents,
      currency: item.currency,
    })),
  };
}

function confirmationUrl(siteUrl, orderReference) {
  return `${siteUrl}/pages/order-confirmation.html?transfer=1&order_reference=${encodeURIComponent(
    orderReference
  )}`;
}

async function updateOrderTimelineForTransfer(supabase, orderId) {
  try {
    const { error } = await supabase
      .from("order_status_events")
      .update({
        message: "Order received; final cost and bank transfer instructions will be sent by email.",
        created_by: "checkout",
      })
      .eq("order_id", orderId)
      .eq("status", "pending_payment")
      .eq("created_by", "checkout");
    if (error) throw error;
  } catch (error) {
    console.warn("bank_transfer_order_event_update_failed", error);
  }
}

async function sendTransferOrderEmails({ order, siteUrl }) {
  const emailStatus = {
    customer_email_sent: false,
    sales_email_sent: false,
  };

  try {
    await sendBankTransferOrderCustomerEmail({
      order,
      siteUrl,
      salesEmail: getSalesEmail(),
    });
    emailStatus.customer_email_sent = true;
  } catch (error) {
    console.error("bank_transfer_customer_email_failed", {
      order_reference: order.order_reference,
      message: error.message,
    });
  }

  try {
    await sendBankTransferOrderSalesEmail({
      order,
      siteUrl,
      salesEmail: getSalesEmail(),
    });
    emailStatus.sales_email_sent = true;
  } catch (error) {
    console.error("bank_transfer_sales_email_failed", {
      order_reference: order.order_reference,
      message: error.message,
    });
  }

  return emailStatus;
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
      "RESEND_API_KEY",
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
      allowManualOrder: true,
    });

    const checkoutCart = buildCheckoutCart(pricing);
    const { data: checkoutIntent, error: checkoutIntentError } = await supabase
      .from("checkout_intents")
      .insert({
        email: customerEmail,
        cart: checkoutCart,
        subtotal: pricing.subtotalCents / 100,
        discount_cents: pricing.discountCents,
        total: pricing.totalCents / 100,
        pricing_context: {
          ...pricing.pricingContext,
          payment_method: "bank_transfer",
        },
        currency: pricing.currency,
        status: "new",
        notes: `Bank transfer order. Confirm final shipping, duties, taxes, and payment instructions through ${getSalesEmail()}.`,
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
          payment_method: "bank_transfer",
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
    const order = buildTransferOrder({ createdOrder, customerEmail, pricing });

    await updateOrderTimelineForTransfer(supabase, order.id);

    if (pricing.privateGrant) {
      try {
        await recordPrivatePricingUsage(supabase, pricing.privateGrant.id);
      } catch (usageError) {
        console.error("private_pricing_usage_update_failed", usageError);
      }
    }

    const emailStatus = await sendTransferOrderEmails({ order, siteUrl });
    const url = confirmationUrl(siteUrl, order.order_reference);

    json(res, 200, {
      ok: true,
      url,
      order_id: order.id,
      order_reference: order.order_reference,
      payment_method: "bank_transfer",
      sales_email: getSalesEmail(),
      ...emailStatus,
      order: publicOrderPayload(order),
      ...publicQuotePayload(pricing),
    });
  } catch (error) {
    handleError(res, error);
  }
};
