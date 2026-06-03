const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getQuery, getPagination } = require("../../_lib/admin");

const LIST_SELECT = `
  id,
  return_reference,
  order_id,
  customer_email,
  requested_resolution,
  status,
  reason,
  created_at,
  updated_at
`;

const RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "received",
  "refunded",
  "replaced",
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
      .from("return_requests")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = String(query.status || "").trim();
    if (status && RETURN_STATUSES.includes(status)) {
      builder = builder.eq("status", status);
    }

    const search = String(query.search || "").trim();
    if (search) {
      builder = builder.or(
        `return_reference.ilike.%${search.toUpperCase()}%,customer_email.ilike.%${search}%`
      );
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      returns: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
