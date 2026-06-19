const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { buildIlikeOr, getQuery, getPagination, normalizeSearchTerm } = require("../../_lib/admin");

const LIST_SELECT = `
  id,
  order_reference,
  customer_email,
  currency,
  total_cents,
  order_status,
  payment_status,
  fulfillment_status,
  created_at,
  paid_at
`;

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
];

const FULFILLMENT_STATUSES = [
  "not_started",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

function parseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    await requireAdmin(req);

    const query = getQuery(req);
    const { page, pageSize, from, to } = getPagination(query);
    const supabase = getSupabaseAdmin();

    let builder = supabase
      .from("orders")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = String(query.status || "").trim();
    if (status && ORDER_STATUSES.includes(status)) {
      builder = builder.eq("order_status", status);
    }

    const payment = String(query.payment_status || "").trim();
    if (payment && PAYMENT_STATUSES.includes(payment)) {
      builder = builder.eq("payment_status", payment);
    }

    const fulfillment = String(query.fulfillment_status || "").trim();
    if (fulfillment && FULFILLMENT_STATUSES.includes(fulfillment)) {
      builder = builder.eq("fulfillment_status", fulfillment);
    }

    const dateFrom = parseDate(query.date_from);
    if (dateFrom) builder = builder.gte("created_at", dateFrom);

    const dateTo = parseDate(query.date_to);
    if (dateTo) builder = builder.lte("created_at", dateTo);

    const search = normalizeSearchTerm(query.search);
    if (search) {
      builder = builder.or(buildIlikeOr([
        { column: "order_reference", value: search.toUpperCase() },
        { column: "customer_email", value: search },
      ]));
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      orders: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
