const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const {
  buildIlikeOr,
  getQuery,
  getPagination,
  normalizeSearchTerm,
} = require("../../_lib/admin");

const QUOTE_STATUSES = ["new", "contacted", "quoted", "closed", "spam"];

const LIST_SELECT = `
  id,
  name,
  company_name,
  email,
  whatsapp,
  country,
  item_count,
  quantity_count,
  source_page,
  status,
  created_at,
  updated_at
`;

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
      .from("wholesale_quote_requests")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = String(query.status || "").trim();
    if (QUOTE_STATUSES.includes(status)) {
      builder = builder.eq("status", status);
    }

    const search = normalizeSearchTerm(query.search);
    if (search) {
      builder = builder.or(buildIlikeOr([
        { column: "email", value: search },
        { column: "name", value: search },
        { column: "company_name", value: search },
        { column: "country", value: search },
      ]));
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      quote_requests: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
