const { getSupabaseAdmin } = require("./supabase");

const ADMIN_ROLES = ["admin", "super_admin"];

function authError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getBearerToken(req) {
  const header = req.headers["authorization"] || req.headers["Authorization"];
  if (!header) return null;
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Resolve the authenticated Supabase user from the request's Bearer token.
 * Throws 401 when the token is missing or invalid.
 */
async function getAuthedUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    throw authError(401, "unauthenticated", "Authentication required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    throw authError(401, "invalid_token", "Your session is invalid or has expired.");
  }
  return data.user;
}

/**
 * Resolve the authenticated Supabase user when a Bearer token is present.
 * Returns null for anonymous requests (no Authorization header), but throws
 * 401 when a token is present and invalid so callers never silently degrade.
 */
async function getOptionalAuthedUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    throw authError(401, "invalid_token", "Your session is invalid or has expired.");
  }
  return data.user;
}

/**
 * Read the role for a given user id from public.profiles using the service role.
 */
async function getRole(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw authError(500, "profile_lookup_failed", "Could not verify your account.");
  }
  return data || null;
}

/**
 * Require the caller to be at least an admin. Returns a context object
 * { user, profile, role } for use by handlers (e.g. audit logging).
 */
async function requireAdmin(req) {
  const user = await getAuthedUser(req);
  const profile = await getRole(user.id);
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    throw authError(403, "forbidden", "You do not have access to this resource.");
  }
  return { user, profile, role: profile.role };
}

/**
 * Require the caller to be a super_admin.
 */
async function requireSuperAdmin(req) {
  const ctx = await requireAdmin(req);
  if (ctx.role !== "super_admin") {
    throw authError(403, "forbidden_super_admin", "This action requires super admin access.");
  }
  return ctx;
}

/**
 * Record a privileged action in admin_audit_log. Never throws — auditing
 * must not break the primary operation.
 */
async function logAudit(ctx, action, targetType, targetId, metadata) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("admin_audit_log").insert({
      actor_id: ctx && ctx.user ? ctx.user.id : null,
      actor_email: ctx && ctx.user
        ? ctx.user.email
        : (ctx && ctx.profile ? ctx.profile.email : null),
      actor_role: ctx ? ctx.role : null,
      action,
      target_type: targetType || null,
      target_id: targetId != null ? String(targetId) : null,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error("audit_log_failed", err);
  }
}

module.exports = {
  ADMIN_ROLES,
  getBearerToken,
  getAuthedUser,
  getOptionalAuthedUser,
  getRole,
  requireAdmin,
  requireSuperAdmin,
  logAudit,
};
