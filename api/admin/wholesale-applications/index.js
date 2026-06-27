const { handleError, json, methodNotAllowed, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const {
  buildIlikeOr,
  getQuery,
  getPagination,
  normalizeSearchTerm,
} = require("../../_lib/admin");
const {
  WHOLESALE_APPLICATION_STATUSES,
} = require("../../_lib/wholesale-applications");

const LIST_SELECT = `
  id,
  email,
  full_name,
  company_name,
  business_type,
  years_in_business,
  phone,
  website_url,
  city,
  region,
  country,
  desired_products,
  investment_budget_usd,
  import_experience,
  sales_channel,
  customer_reach,
  monthly_volume,
  status,
  decision_email_sent_at,
  reviewed_at,
  converted_grant_id,
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
      .from("wholesale_applications")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = String(query.status || "").trim();
    if (WHOLESALE_APPLICATION_STATUSES.includes(status)) {
      builder = builder.eq("status", status);
    }

    const search = normalizeSearchTerm(query.search);
    if (search) {
      builder = builder.or(buildIlikeOr([
        { column: "email", value: search },
        { column: "full_name", value: search },
        { column: "company_name", value: search },
      ]));
    }

    const { data, count, error } = await builder;
    if (error) throw error;

    json(res, 200, {
      applications: data || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (error) {
    handleError(res, error);
  }
};
