const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getQuery, getPagination } = require("../../_lib/admin");

const LIST_SELECT =
  "id, email, user_id, subtotal, currency, status, notes, created_at, updated_at";

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

    const search = String(query.search || "").trim();
    if (search) {
      builder = builder.ilike("email", `%${search}%`);
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
