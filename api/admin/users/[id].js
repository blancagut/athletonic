const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../../_lib/http");
const { requireSuperAdmin, logAudit } = require("../../_lib/auth");
const { getSupabaseAdmin } = require("../../_lib/supabase");
const { getParam } = require("../../_lib/admin");

const ROLES = ["user", "admin", "super_admin"];
const OWNER_EMAIL = "renvagu1@icloud.com";

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

module.exports = async function handler(req, res) {
  if (req.method !== "PATCH") {
    methodNotAllowed(res, ["PATCH"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireSuperAdmin(req);

    const userId = getParam(req, "id");
    if (!userId) throw validationError("Missing user id.", "missing_id");

    const body = await readJson(req);
    const newRole = String(body.role || "").trim();
    if (!ROLES.includes(newRole)) {
      throw validationError("Invalid role.", "invalid_role");
    }

    const supabase = getSupabaseAdmin();

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      error.code = "user_not_found";
      throw error;
    }

    // A super admin cannot demote themselves (avoid locking out the tier).
    if (target.id === ctx.user.id && newRole !== target.role) {
      throw validationError("You cannot change your own role.", "self_role_change");
    }

    if (target.email === OWNER_EMAIL && newRole !== "super_admin") {
      throw validationError("The owner account cannot be demoted.", "owner_demote_blocked");
    }

    if (newRole === "super_admin" && target.email !== OWNER_EMAIL) {
      throw validationError("Only the owner account can hold the super admin role.", "owner_only_super_admin");
    }

    const expectedConfirmation = `${target.email}:${newRole}`;
    if (newRole !== target.role && body.confirmation !== expectedConfirmation) {
      throw validationError("Role changes require confirmation.", "confirmation_required");
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    if (updateError) throw updateError;

    await logAudit(ctx, "user.role_change", "profile", userId, {
      email: target.email,
      from: target.role,
      to: newRole,
    });

    json(res, 200, {
      user: { id: target.id, email: target.email, role: newRole },
    });
  } catch (error) {
    handleError(res, error);
  }
};
