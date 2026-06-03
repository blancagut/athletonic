const { handleError, json, methodNotAllowed, requireEnv } = require("../_lib/http");
const { requireAdmin } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const ctx = await requireAdmin(req);
    json(res, 200, {
      user: {
        id: ctx.user.id,
        email: ctx.profile.email,
        full_name: ctx.profile.full_name || null,
        role: ctx.role,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
