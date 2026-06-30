const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");

const QUOTE_STATUSES = ["new", "contacted", "quoted", "closed", "spam"];

const DETAIL_SELECT = `
  id,
  name,
  company_name,
  email,
  whatsapp,
  country,
  notes,
  items,
  item_count,
  quantity_count,
  source_page,
  metadata,
  status,
  created_at,
  updated_at
`;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

async function fetchQuoteRequest(supabase, id) {
  const { data, error } = await supabase
    .from("wholesale_quote_requests")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Wholesale quote request not found.");
    notFound.statusCode = 404;
    notFound.code = "quote_request_not_found";
    throw notFound;
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    methodNotAllowed(res, ["GET", "PATCH"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireSuperAdmin(req);
    const id = getParam(req, "id");
    if (!id) throw validationError("Missing quote request id.", "missing_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const quoteRequest = await fetchQuoteRequest(supabase, id);
      json(res, 200, { quote_request: quoteRequest });
      return;
    }

    const body = await readJson(req);
    const status = String(body.status || "").trim();
    if (!QUOTE_STATUSES.includes(status)) {
      throw validationError("Invalid quote request status.", "invalid_status");
    }

    const { data, error } = await supabase
      .from("wholesale_quote_requests")
      .update({ status })
      .eq("id", id)
      .select(DETAIL_SELECT)
      .single();
    if (error) throw error;

    await logAudit(ctx, "wholesale_quote_request.update_status", "wholesale_quote_request", id, {
      status,
      email: data.email,
    });

    json(res, 200, { quote_request: data });
  } catch (error) {
    handleError(res, error);
  }
};
