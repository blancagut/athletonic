const { handleError, json, methodNotAllowed, readJson, requireEnv, getSiteUrl } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");
const {
  codeHint,
  generateAccessCode,
  hashAccessCode,
  sanitizeProfile,
} = require("../../_lib/private-pricing");
const { normalizeDecision } = require("../../_lib/wholesale-applications");
const { sendWholesaleApplicationDecisionEmail } = require("../../_lib/email");

const DETAIL_SELECT = `
  id,
  email,
  full_name,
  company_name,
  business_type,
  years_in_business,
  phone,
  website_url,
  address_line1,
  address_line2,
  city,
  region,
  postal_code,
  country,
  desired_products,
  investment_budget_usd,
  import_experience,
  sales_channel,
  customer_reach,
  order_frequency,
  sales_regions,
  fulfillment_setup,
  reseller_or_tax_id,
  monthly_volume,
  product_interest,
  business_plan,
  notes,
  source_page,
  metadata,
  status,
  decision_notes,
  decision_email_sent_at,
  decision_email_error,
  reviewed_by,
  reviewed_at,
  converted_grant_id,
  created_at,
  updated_at
`;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

async function fetchApplication(supabase, id) {
  const { data, error } = await supabase
    .from("wholesale_applications")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Wholesale application not found.");
    notFound.statusCode = 404;
    notFound.code = "application_not_found";
    throw notFound;
  }
  return data;
}

async function findProfileIdByEmail(supabase, email) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

async function ensureWholesaleGrant(supabase, application, ctx, profile) {
  const authUserId = await findProfileIdByEmail(supabase, application.email);
  const { data: existing, error: existingError } = await supabase
    .from("private_pricing_grants")
    .select("id, email, status, auth_user_id, code_hint, profile")
    .eq("email", application.email)
    .maybeSingle();
  if (existingError) throw existingError;

  const patch = {
    status: "active",
    profile,
    revoked_by: null,
    revoked_at: null,
  };
  if (authUserId) patch.auth_user_id = authUserId;

  if (existing) {
    const { data, error } = await supabase
      .from("private_pricing_grants")
      .update(patch)
      .eq("id", existing.id)
      .select("id, email, status, code_hint, profile, auth_user_id")
      .single();
    if (error) throw error;
    return { grant: data, accessCode: null, created: false };
  }

  const accessCode = generateAccessCode();
  const row = {
    email: application.email,
    status: "active",
    code_hash: hashAccessCode(accessCode),
    code_hint: codeHint(accessCode),
    profile,
    created_by: ctx.user.id,
  };
  if (authUserId) row.auth_user_id = authUserId;

  const { data, error } = await supabase
    .from("private_pricing_grants")
    .insert(row)
    .select("id, email, status, code_hint, profile, auth_user_id")
    .single();
  if (error) throw error;
  return { grant: data, accessCode, created: true };
}

async function markDecision(supabase, id, patch) {
  const { data, error } = await supabase
    .from("wholesale_applications")
    .update(patch)
    .eq("id", id)
    .select(DETAIL_SELECT)
    .single();
  if (error) throw error;
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
    if (!id) throw validationError("Missing application id.", "missing_id");

    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const application = await fetchApplication(supabase, id);
      json(res, 200, { application });
      return;
    }

    const body = await readJson(req);
    const decision = normalizeDecision(body);
    if (decision.action === "approve") {
      requireEnv(["RESEND_API_KEY", "ATHLETONIC_PRIVATE_PRICING_SECRET"]);
    } else if (decision.action === "reject") {
      requireEnv(["RESEND_API_KEY"]);
    }
    const application = await fetchApplication(supabase, id);

    if (application.status === "approved" || application.status === "rejected") {
      throw validationError("This application already has a final decision.", "decision_final");
    }

    if (decision.action === "under_review") {
      const updated = await markDecision(supabase, id, {
        status: "under_review",
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
        decision_notes: decision.decision_notes,
        decision_email_error: null,
      });
      await logAudit(ctx, "wholesale_application.under_review", "wholesale_application", id, {
        email: application.email,
      });
      json(res, 200, { application: updated });
      return;
    }

    const siteUrl = getSiteUrl(req);
    if (decision.action === "approve") {
      const profile = sanitizeProfile(decision.profile || "wholesale");
      let grantResult = null;
      try {
        grantResult = await ensureWholesaleGrant(supabase, application, ctx, profile);
        await sendWholesaleApplicationDecisionEmail({
          application,
          decision: "approved",
          decisionNotes: decision.decision_notes,
          accessCode: grantResult.accessCode,
          siteUrl,
        });
      } catch (error) {
        if (grantResult && grantResult.created && grantResult.grant && grantResult.grant.id) {
          await supabase
            .from("private_pricing_grants")
            .update({
              status: "revoked",
              revoked_by: ctx.user.id,
              revoked_at: new Date().toISOString(),
            })
            .eq("id", grantResult.grant.id);
        }
        await supabase
          .from("wholesale_applications")
          .update({ decision_email_error: error.message || "Email failed." })
          .eq("id", id);
        throw error;
      }

      const updated = await markDecision(supabase, id, {
        status: "approved",
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
        decision_notes: decision.decision_notes,
        decision_email_sent_at: new Date().toISOString(),
        decision_email_error: null,
        converted_grant_id: grantResult.grant.id,
      });
      await logAudit(ctx, "wholesale_application.approve", "wholesale_application", id, {
        email: application.email,
        grant_id: grantResult.grant.id,
        generated_code: Boolean(grantResult.accessCode),
      });
      json(res, 200, {
        application: updated,
        grant: grantResult.grant,
        email_sent: true,
      });
      return;
    }

    if (decision.action === "reject") {
      await sendWholesaleApplicationDecisionEmail({
        application,
        decision: "rejected",
        decisionNotes: decision.decision_notes,
        siteUrl,
      });
      const updated = await markDecision(supabase, id, {
        status: "rejected",
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
        decision_notes: decision.decision_notes,
        decision_email_sent_at: new Date().toISOString(),
        decision_email_error: null,
      });
      await logAudit(ctx, "wholesale_application.reject", "wholesale_application", id, {
        email: application.email,
      });
      json(res, 200, {
        application: updated,
        email_sent: true,
      });
    }
  } catch (error) {
    handleError(res, error);
  }
};
