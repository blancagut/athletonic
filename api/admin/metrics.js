const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { requireAdmin } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");

async function countBy(supabase, table, column, value) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (column) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
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

    const [
      ordersTotal,
      ordersPaid,
      ordersPending,
      ordersProcessing,
      ordersShipped,
      returnsOpen,
      intentsNew,
      adminsCount,
    ] = await Promise.all([
      countBy(supabase, "orders"),
      countBy(supabase, "orders", "payment_status", "paid"),
      countBy(supabase, "orders", "order_status", "pending_payment"),
      countBy(supabase, "orders", "fulfillment_status", "processing"),
      countBy(supabase, "orders", "fulfillment_status", "shipped"),
      countBy(supabase, "return_requests", "status", "requested"),
      countBy(supabase, "checkout_intents", "status", "new"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["admin", "super_admin"])
        .then(({ count, error }) => {
          if (error) throw error;
          return count || 0;
        }),
    ]);

    // Revenue from paid orders (sum of total_cents).
    const { data: revenueRows, error: revenueError } = await supabase
      .from("orders")
      .select("total_cents")
      .eq("payment_status", "paid");
    if (revenueError) throw revenueError;
    const revenueCents = (revenueRows || []).reduce(
      (sum, row) => sum + Number(row.total_cents || 0),
      0
    );

    json(res, 200, {
      metrics: {
        orders: {
          total: ordersTotal,
          paid: ordersPaid,
          pending_payment: ordersPending,
          processing: ordersProcessing,
          shipped: ordersShipped,
        },
        revenue_cents: revenueCents,
        revenue: revenueCents / 100,
        returns_open: returnsOpen,
        checkout_intents_new: intentsNew,
        admins: adminsCount,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
