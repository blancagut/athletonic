const { normalizeEmail } = require("../_lib/catalog");
const { buildCheckoutPricing, publicQuotePayload } = require("../_lib/checkout-pricing");
const {
  getClientIp,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  requireEnv,
} = require("../_lib/http");
const { accessCodeProvided } = require("../_lib/private-pricing");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJson(req);
    const hasAccessCode = accessCodeProvided(body.access_code);
    if (hasAccessCode) {
      requireEnv([
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ATHLETONIC_PRIVATE_PRICING_SECRET",
      ]);
    }

    const customerEmail = normalizeEmail(body.email);
    const pricing = await buildCheckoutPricing({
      supabase: hasAccessCode ? getSupabaseAdmin() : null,
      email: customerEmail,
      cart: body.cart,
      accessCode: body.access_code,
      clientIp: getClientIp(req),
    });

    json(res, 200, publicQuotePayload(pricing));
  } catch (error) {
    handleError(res, error);
  }
};
