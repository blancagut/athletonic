const {
  evaluateCart,
  evaluateCartWithOverrides,
} = require("../_lib/catalog");
const { handleError, json, methodNotAllowed, readJson } = require("../_lib/http");
const { getSupabaseAdmin } = require("../_lib/supabase");

function hasSupabaseEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJson(req);
    const cart = Array.isArray(body.cart) ? body.cart : [];
    const validation = hasSupabaseEnv()
      ? await evaluateCartWithOverrides(cart, {
          supabase: getSupabaseAdmin(),
        })
      : evaluateCart(cart);

    json(res, 200, {
      valid: validation.valid,
      code: validation.code || null,
      message: validation.message || null,
      subtotal_cents: validation.subtotalCents,
      currency: validation.currency,
      items: validation.items,
      line_items: validation.lineItems,
      invalid_items: validation.invalidItems,
    });
  } catch (error) {
    handleError(res, error);
  }
};
