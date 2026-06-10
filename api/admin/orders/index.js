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
