const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { requireAdmin } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");
const catalog = require("../../data/athletonic-catalog.json");

const PRODUCTS = Array.isArray(catalog.products) ? catalog.products : [];

async function countBy(supabase, table, column, value) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (column) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countIn(supabase, table, column, values) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, values);
  if (error) throw error;
  return count || 0;
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function sumCents(rows, column) {
  return (rows || []).reduce((sum, row) => sum + Number(row[column] || 0), 0);
}

function catalogIssueCount(overrides) {
  const overrideMap = new Map((overrides || []).map((row) => [String(row.product_id), row]));
  return PRODUCTS.reduce((count, product) => {
    const override = overrideMap.get(String(product.id));
    const merged = { ...product, ...(override && override.patch ? override.patch : {}) };
    const issue =
      !merged.name ||
      !merged.brand ||
      !Number.isInteger(Number(merged.price_cents)) ||
      Number(merged.price_cents) < 0 ||
      !merged.image ||
      Boolean(override && override.hidden);
    return issue ? count + 1 : count;
  }, 0);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    await requireAdmin(req);

    const supabase = getSupabaseAdmin();

    const todayStart = startOfTodayIso();

    const [
      ordersTotal,
      ordersPaid,
      ordersPendingPayment,
      ordersProcessing,
      ordersShipped,
      ordersDelivered,
      ordersNeedingAction,
      returnsOpen,
      intentsPending,
      adminsCount,
      overrideRowsResult,
    ] = await Promise.all([
      countBy(supabase, "orders"),
      countBy(supabase, "orders", "payment_status", "paid"),
      countBy(supabase, "orders", "order_status", "pending_payment"),
      countBy(supabase, "orders", "fulfillment_status", "processing"),
      countBy(supabase, "orders", "fulfillment_status", "shipped"),
      countBy(supabase, "orders", "fulfillment_status", "delivered"),
      countIn(supabase, "orders", "fulfillment_status", ["not_started", "processing"]),
      countIn(supabase, "return_requests", "status", ["requested", "under_review", "approved"]),
      countIn(supabase, "checkout_intents", "status", ["new", "contacted"]),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["admin", "super_admin"])
        .then(({ count, error }) => {
          if (error) throw error;
          return count || 0;
        }),
      supabase.from("product_overrides").select("product_id, patch, hidden"),
    ]);

    if (overrideRowsResult.error) throw overrideRowsResult.error;

    // Revenue from paid orders (sum of total_cents).
    const { data: revenueRows, error: revenueError } = await supabase
      .from("orders")
      .select("total_cents")
      .eq("payment_status", "paid");
    if (revenueError) throw revenueError;

    const { data: todayRevenueRows, error: todayRevenueError } = await supabase
      .from("orders")
      .select("total_cents")
      .eq("payment_status", "paid")
      .gte("paid_at", todayStart);
    if (todayRevenueError) throw todayRevenueError;

    const { data: recentOrders, error: recentOrdersError } = await supabase
      .from("orders")
      .select("id, order_reference, customer_email, currency, total_cents, order_status, payment_status, fulfillment_status, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    if (recentOrdersError) throw recentOrdersError;

    const { data: recentReturns, error: recentReturnsError } = await supabase
      .from("return_requests")
      .select("id, return_reference, order_id, customer_email, requested_resolution, status, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (recentReturnsError) throw recentReturnsError;

    const { data: recentAudit, error: recentAuditError } = await supabase
      .from("admin_audit_log")
      .select("id, actor_email, actor_role, action, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (recentAuditError) throw recentAuditError;

    const revenueCents = sumCents(revenueRows, "total_cents");
    const todayRevenueCents = sumCents(todayRevenueRows, "total_cents");

    json(res, 200, {
      metrics: {
        orders: {
          total: ordersTotal,
          paid: ordersPaid,
          pending_payment: ordersPendingPayment,
          processing: ordersProcessing,
          shipped: ordersShipped,
          delivered: ordersDelivered,
          needing_action: ordersNeedingAction,
        },
        revenue_cents: revenueCents,
        revenue: revenueCents / 100,
        today_revenue_cents: todayRevenueCents,
        today_revenue: todayRevenueCents / 100,
        returns_open: returnsOpen,
        checkout_intents_pending: intentsPending,
        catalog_issues: catalogIssueCount(overrideRowsResult.data),
        admins: adminsCount,
      },
      recent: {
        orders: recentOrders || [],
        returns: recentReturns || [],
        audit: recentAudit || [],
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
