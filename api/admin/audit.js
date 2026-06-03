const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { requireAdmin } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { getQuery, getPagination } = require("../_lib/admin");

const LIST_SELECT =
  "id, actor_email, actor_role, action, target_type, target_id, metadata, created_at";

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
      .from("admin_audit_log")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const action = String(query.action || "").trim();
    if (action) builder = builder.eq("action", action);

    const targetType = String(query.target_type || "").trim();
    if (targetType) builder = builder.eq("target_type", targetType);

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      events: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
