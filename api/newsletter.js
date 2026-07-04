const { normalizeEmail } = require("./_lib/validation");
const { sendNewsletterWelcomeEmail } = require("./_lib/email");
const {
  getSiteUrl,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  requireEnv,
} = require("./_lib/http");
const { getSupabaseAdmin } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"]);

    const body = await readJson(req);
    if (String(body.company || "").trim() !== "") {
      json(res, 200, { ok: true });
      return;
    }

    const email = normalizeEmail(body.email);
    const supabase = getSupabaseAdmin();
    const siteUrl = getSiteUrl(req);

    const { data: existing, error: existingError } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      existingError.statusCode = 500;
      throw existingError;
    }

    if (existing) {
      json(res, 200, {
        ok: true,
        already_subscribed: true,
        message: "You're already subscribed.",
      });
      return;
    }

    const { error: insertError } = await supabase.from("newsletter_subscribers").insert({
      email,
      source: String(body.source || "footer").trim().slice(0, 120) || "footer",
      status: "subscribed",
      metadata: {
        page: typeof body.page === "string" ? body.page.slice(0, 500) : null,
      },
    });

    if (insertError) {
      insertError.statusCode = 500;
      throw insertError;
    }

    try {
      await sendNewsletterWelcomeEmail({ email, siteUrl });
    } catch (emailError) {
      console.error("newsletter_welcome_email_failed", {
        email,
        message: emailError.message,
      });
    }

    json(res, 200, {
      ok: true,
      message: "Thanks - you're on the list.",
    });
  } catch (error) {
    handleError(res, error);
  }
};
