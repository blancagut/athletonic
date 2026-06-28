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
const { getBearerToken, getOptionalAuthedUser } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJson(req);
    const hasAccessCode = accessCodeProvided(body.access_code);
    const hasAuth = Boolean(getBearerToken(req));
    const needsSupabase = true;

    requireEnv([
      ...(needsSupabase ? ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] : []),
      ...(hasAccessCode ? ["ATHLETONIC_PRIVATE_PRICING_SECRET"] : []),
    ]);

    // When authenticated, trust the verified identity over body.email so a
    // signed-in user cannot quote another account's wholesale pricing.
    const authedUser = hasAuth ? await getOptionalAuthedUser(req) : null;
    const customerEmail = authedUser
      ? normalizeEmail(authedUser.email)
      : normalizeEmail(body.email);

    const pricing = await buildCheckoutPricing({
      supabase: needsSupabase ? getSupabaseAdmin() : null,
      email: customerEmail,
      cart: body.cart,
      accessCode: body.access_code,
      clientIp: getClientIp(req),
      authUserId: authedUser ? authedUser.id : null,
    });

    json(res, 200, publicQuotePayload(pricing));
  } catch (error) {
    handleError(res, error);
  }
};
