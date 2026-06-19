const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { requireAdmin } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");
const { buildIlikeOr, getQuery, getPagination, normalizeSearchTerm } = require("../_lib/admin");

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

    const actor = normalizeSearchTerm(query.actor || query.actor_email);
    if (actor) builder = builder.ilike("actor_email", `%${actor}%`);

    const target = normalizeSearchTerm(query.target || query.target_id);
    if (target) builder = builder.ilike("target_id", `%${target}%`);

    const dateFrom = Date.parse(String(query.date_from || ""));
    if (Number.isFinite(dateFrom)) builder = builder.gte("created_at", new Date(dateFrom).toISOString());

    const dateTo = Date.parse(String(query.date_to || ""));
    if (Number.isFinite(dateTo)) builder = builder.lte("created_at", new Date(dateTo).toISOString());

    const search = normalizeSearchTerm(query.search);
    if (search) {
      builder = builder.or(buildIlikeOr([
        { column: "actor_email", value: search },
        { column: "action", value: search },
        { column: "target_type", value: search },
        { column: "target_id", value: search },
      ]));
    }

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
