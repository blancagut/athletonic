const { normalizeWholesaleApplication } = require("../_lib/wholesale-applications");
const {
  getClientIp,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  requireEnv,
} = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const body = await readJson(req);
    const application = normalizeWholesaleApplication(body);

    if (application.honeypot) {
      json(res, 200, {
        ok: true,
        message: "Application received.",
      });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: openApplication, error: openError } = await supabase
      .from("wholesale_applications")
      .select("id, status")
      .eq("email", application.email)
      .in("status", ["pending", "under_review"])
      .maybeSingle();
    if (openError) {
      openError.statusCode = 500;
      throw openError;
    }

    if (openApplication) {
      json(res, 200, {
        ok: true,
        already_pending: true,
        message: "Your application is already under review.",
      });
      return;
    }

    const { error } = await supabase.from("wholesale_applications").insert({
      ...application,
      status: "pending",
      metadata: {
        ...(application.metadata || {}),
        client_ip: getClientIp(req),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      },
    });

    if (error) {
      if (error.code === "23505") {
        json(res, 200, {
          ok: true,
          already_pending: true,
          message: "Your application is already under review.",
        });
        return;
      }
      error.statusCode = 500;
      throw error;
    }

    json(res, 201, {
      ok: true,
      message: "Application received. Our team will review it and reply by email.",
    });
  } catch (error) {
    handleError(res, error);
  }
};
