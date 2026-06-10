const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { buildIlikeOr, getQuery, getPagination, normalizeSearchTerm } = require("../../_lib/admin");

const LIST_SELECT = "id, email, full_name, role, created_at, updated_at";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    await requireSuperAdmin(req);

    const query = getQuery(req);
    const { page, pageSize, from, to } = getPagination(query);
    const supabase = getSupabaseAdmin();

    let builder = supabase
      .from("profiles")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const role = String(query.role || "").trim();
    if (["user", "admin", "super_admin"].includes(role)) {
      builder = builder.eq("role", role);
    }

    const search = normalizeSearchTerm(query.search);
    if (search) {
      builder = builder.or(buildIlikeOr([
        { column: "email", value: search },
        { column: "full_name", value: search },
      ]));
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      users: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
