const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getQuery, getPagination, normalizeSearchTerm } = require("../../_lib/admin");

const LIST_SELECT = `
  id,
  email,
  user_id,
  cart,
  subtotal,
  total,
  discount_cents,
  currency,
  status,
  notes,
  created_at,
  updated_at,
  orders (
    order_reference,
    order_status,
    payment_status,
    fulfillment_status,
    total_cents
  )
`;

const INTENT_STATUSES = ["new", "contacted", "converted", "cancelled"];

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
      .from("checkout_intents")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = String(query.status || "").trim();
    if (status && INTENT_STATUSES.includes(status)) {
      builder = builder.eq("status", status);
    }

    const search = normalizeSearchTerm(query.search);
    if (search) {
      let matchingIntentIds = [];
      if (/^ATH[-A-Z0-9]+$/i.test(search)) {
        const { data: orderMatches, error: orderSearchError } = await supabase
          .from("orders")
          .select("checkout_intent_id")
          .ilike("order_reference", `%${search.toUpperCase()}%`)
          .not("checkout_intent_id", "is", null)
          .limit(50);
        if (orderSearchError) throw orderSearchError;
        matchingIntentIds = (orderMatches || []).map((row) => row.checkout_intent_id).filter(Boolean);
      }

      if (matchingIntentIds.length) {
        builder = builder.in("id", matchingIntentIds);
      } else {
        builder = builder.ilike("email", `%${search}%`);
      }
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      intents: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
