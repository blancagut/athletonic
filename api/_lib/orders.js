const ORDER_SELECT = `
  id,
  order_reference,
  customer_email,
  currency,
  subtotal_cents,
  shipping_cents,
  tax_cents,
  discount_cents,
  total_cents,
  order_status,
  payment_status,
  fulfillment_status,
  shipping_method,
  shipping_address,
  tracking_carrier,
  tracking_number,
  tracking_url,
  paid_at,
  shipped_at,
  delivered_at,
  cancelled_at,
  refunded_at,
  created_at,
  updated_at,
  order_items (
    id,
    product_id,
    brand,
    name,
    variant,
    image_url,
    quantity,
    unit_amount_cents,
    line_subtotal_cents,
    currency
  ),
  order_status_events (
    status,
    message,
    created_by,
    created_at
  )
`;

function moneyFromCents(cents) {
  return Number(cents || 0) / 100;
}

function sanitizeOrder(order) {
  if (!order) return null;

  const items = [...(order.order_items || [])].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );
  const events = [...(order.order_status_events || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    id: order.id,
    order_reference: order.order_reference,
    customer_email: order.customer_email,
    currency: order.currency,
    amounts: {
      subtotal_cents: order.subtotal_cents,
      shipping_cents: order.shipping_cents,
      tax_cents: order.tax_cents,
      discount_cents: order.discount_cents,
      total_cents: order.total_cents,
      subtotal: moneyFromCents(order.subtotal_cents),
      shipping: moneyFromCents(order.shipping_cents),
      tax: moneyFromCents(order.tax_cents),
      discount: moneyFromCents(order.discount_cents),
      total: moneyFromCents(order.total_cents),
    },
    order_status: order.order_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    shipping_method: order.shipping_method,
    shipping_address: order.shipping_address,
    tracking: {
      carrier: order.tracking_carrier,
      number: order.tracking_number,
      url: order.tracking_url,
    },
    timestamps: {
      created_at: order.created_at,
      updated_at: order.updated_at,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      cancelled_at: order.cancelled_at,
      refunded_at: order.refunded_at,
    },
    items,
    events,
  };
}

async function fetchOrderById(supabase, orderId) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) return { order: null, error };
  return { order: sanitizeOrder(data), error: null };
}

async function fetchOrderByReferenceAndEmail(supabase, reference, email) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("order_reference", reference)
    .eq("customer_email", email)
    .single();

  if (error) return { order: null, error };
  return { order: sanitizeOrder(data), error: null };
}

async function fetchOrderBySession(supabase, sessionId) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("stripe_checkout_session_id", sessionId)
    .single();

  if (error) return { order: null, error };
  return { order: sanitizeOrder(data), error: null };
}

async function fetchOrdersForCustomer(supabase, options) {
  const userId = String(options?.userId || "").trim();
  const email = String(options?.email || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(options?.limit) || 12, 1), 25);

  if (!userId || !email) {
    return { orders: [], error: null };
  }

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .or(`user_id.eq.${userId},customer_email.eq.${email}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { orders: [], error };
  return { orders: (data || []).map(sanitizeOrder).filter(Boolean), error: null };
}

module.exports = {
  fetchOrderById,
  fetchOrderByReferenceAndEmail,
  fetchOrdersForCustomer,
  fetchOrderBySession,
  sanitizeOrder,
};
