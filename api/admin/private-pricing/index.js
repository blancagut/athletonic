const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const {
  buildIlikeOr,
  getQuery,
  getPagination,
  normalizeSearchTerm,
} = require("../../_lib/admin");
const {
  codeHint,
  generateAccessCode,
  hashAccessCode,
  sanitizeProfile,
} = require("../../_lib/private-pricing");
const { normalizeEmail } = require("../../_lib/catalog");

const LIST_SELECT = `
  id,
  email,
  status,
  code_hint,
  profile,
  auth_user_id,
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
  if (value == null || String(value).trim() === "") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw validationError("expires_at must be a valid date.", "invalid_expires_at");
  }
  return new Date(timestamp).toISOString();
}

module.exports = async function handler(req, res) {
  try {
    requireEnv([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "ATHLETONIC_PRIVATE_PRICING_SECRET",
    ]);
    const ctx = await requireSuperAdmin(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      const query = getQuery(req);
      const { page, pageSize, from, to } = getPagination(query);

      let builder = supabase
        .from("private_pricing_grants")
        .select(LIST_SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      const status = String(query.status || "").trim();
      if (["active", "revoked"].includes(status)) {
        builder = builder.eq("status", status);
      }

      const search = normalizeSearchTerm(query.search);
      if (search) {
        builder = builder.or(buildIlikeOr([
          { column: "email", value: search },
          { column: "profile", value: search },
        ]));
      }

      const { data, count, error } = await builder;
      if (error) throw error;

      json(res, 200, {
        grants: data || [],
        pagination: { page, page_size: pageSize, total: count || 0 },
      });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const profile = sanitizeProfile(body.profile);
      const expiresAt = normalizeExpiresAt(body.expires_at);
      const accessCode = generateAccessCode();

      const row = {
        email,
        status: "active",
        code_hash: hashAccessCode(accessCode),
        code_hint: codeHint(accessCode),
        profile,
        expires_at: expiresAt,
        revoked_by: null,
        revoked_at: null,
        created_by: ctx.user.id,
      };

      const { data, error } = await supabase
        .from("private_pricing_grants")
        .upsert(row, { onConflict: "email" })
        .select(LIST_SELECT)
        .single();
      if (error) throw error;

      await logAudit(ctx, "private_pricing.grant_upsert", "private_pricing_grant", data.id, {
        email,
        profile,
        expires_at: expiresAt,
        code_hint: row.code_hint,
      });

      json(res, 201, {
        grant: data,
        access_code: accessCode,
      });
      return;
    }

    methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    handleError(res, error);
  }
};
