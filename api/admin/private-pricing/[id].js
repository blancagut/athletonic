const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");
const {
  codeHint,
  generateAccessCode,
  hashAccessCode,
  sanitizeProfile,
} = require("../../_lib/private-pricing");

const LIST_SELECT = `
  id,
  email,
  status,
  code_hint,
  profile,
  expires_at,
  usage_count,
  last_used_at,
  revoked_at,
  created_at,
  updated_at
`;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function normalizeExpiresAt(value) {
  if (value === undefined) return undefined;
  if (value == null || String(value).trim() === "") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw validationError("expires_at must be a valid date.", "invalid_expires_at");
  }
  return new Date(timestamp).toISOString();
}

async function fetchGrant(supabase, grantId) {
  const { data, error } = await supabase
    .from("private_pricing_grants")
    .select(LIST_SELECT)
    .eq("id", grantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Private pricing grant not found.");
    notFound.statusCode = 404;
    notFound.code = "grant_not_found";
    throw notFound;
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "PATCH") {
    methodNotAllowed(res, ["PATCH"]);
    return;
  }

  try {
    requireEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ATHLETONIC_PRIVATE_PRICING_SECRET",
    ]);
    const ctx = await requireSuperAdmin(req);
    const grantId = getParam(req, "id");
    if (!grantId) throw validationError("Missing grant id.", "missing_id");

    const body = await readJson(req);
    const action = String(body.action || "update").trim();
    const supabase = getSupabaseAdmin();
    const existing = await fetchGrant(supabase, grantId);
    const patch = {};
    let accessCode = null;
    let auditAction = "private_pricing.grant_update";

    if (action === "revoke") {
      patch.status = "revoked";
      patch.revoked_by = ctx.user.id;
      patch.revoked_at = new Date().toISOString();
      auditAction = "private_pricing.grant_revoke";
    } else if (action === "regenerate") {
      accessCode = generateAccessCode();
      patch.status = "active";
      patch.code_hash = hashAccessCode(accessCode);
      patch.code_hint = codeHint(accessCode);
      patch.revoked_by = null;
      patch.revoked_at = null;
      auditAction = "private_pricing.grant_regenerate";
    } else if (action === "update") {
      if (body.status !== undefined) {
        const status = String(body.status || "").trim();
        if (!["active", "revoked"].includes(status)) {
          throw validationError("Invalid status.", "invalid_status");
        }
        patch.status = status;
        if (status === "revoked") {
          patch.revoked_by = ctx.user.id;
          patch.revoked_at = new Date().toISOString();
        } else {
          patch.revoked_by = null;
          patch.revoked_at = null;
        }
      }
      if (body.profile !== undefined) patch.profile = sanitizeProfile(body.profile);
      const expiresAt = normalizeExpiresAt(body.expires_at);
      if (expiresAt !== undefined) patch.expires_at = expiresAt;
    } else {
      throw validationError("Unsupported action.", "invalid_action");
    }

    if (Object.keys(patch).length === 0) {
      throw validationError("No supported fields to update.", "nothing_to_update");
    }

    const { data, error } = await supabase
      .from("private_pricing_grants")
      .update(patch)
      .eq("id", grantId)
      .select(LIST_SELECT)
      .single();
    if (error) throw error;

    const auditPatch = { ...patch };
    if (auditPatch.code_hash) auditPatch.code_hash = "[redacted]";

    await logAudit(ctx, auditAction, "private_pricing_grant", grantId, {
      email: existing.email,
      patch: auditPatch,
    });

    json(res, 200, {
      grant: data,
      access_code: accessCode,
    });
  } catch (error) {
    handleError(res, error);
  }
};
