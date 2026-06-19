const { handleError, json, methodNotAllowed, readJson, requireEnv } = require("../_lib/http");
const { requireAdmin, requireSuperAdmin, logAudit } = require("../_lib/auth");
const { getSupabaseAdmin } = require("../_lib/supabase");

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function integerInRange(value, key, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw validationError(`${key} must be an integer from ${min} to ${max}.`, "invalid_setting_value");
  }
  return number;
}

function booleanValue(value, key) {
  if (typeof value !== "boolean") {
    throw validationError(`${key} must be true or false.`, "invalid_setting_value");
  }
  return value;
}

function validateSettingsValue(key, value) {
  if (key === "shipping") {
    const countries = Array.isArray(value.countries) ? value.countries : [];
    if (!countries.length || countries.some((country) => !/^[A-Z]{2}$/.test(String(country)))) {
      throw validationError("countries must be a list of two-letter country codes.", "invalid_setting_value");
    }
    return {
      flat_amount_cents: integerInRange(value.flat_amount_cents, "flat_amount_cents", 0, 100000),
      free_shipping_min_cents: integerInRange(value.free_shipping_min_cents, "free_shipping_min_cents", 0, 1000000),
      countries: countries.map((country) => String(country).toUpperCase()),
    };
  }

  if (key === "tax") {
    return {
      automatic: booleanValue(value.automatic, "automatic"),
      default_rate_bps: integerInRange(value.default_rate_bps, "default_rate_bps", 0, 10000),
    };
  }

  if (key === "returns") {
    return {
      window_days: integerInRange(value.window_days, "window_days", 0, 365),
      allow_replacement: booleanValue(value.allow_replacement, "allow_replacement"),
      allow_refund: booleanValue(value.allow_refund, "allow_refund"),
    };
  }

  throw validationError("Unsupported settings key.", "unsupported_settings_key");
}

module.exports = async function handler(req, res) {
  try {
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      await requireAdmin(req);
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value, description, updated_at")
        .order("key", { ascending: true });
      if (error) throw error;
      json(res, 200, { settings: data || [] });
      return;
    }

    if (req.method === "PATCH") {
      // Only super admins may change application settings.
      const ctx = await requireSuperAdmin(req);

      const body = await readJson(req);
      const key = String(body.key || "").trim();
      if (!key) throw validationError("Missing settings key.", "missing_key");
      if (body.value === undefined || typeof body.value !== "object" || body.value === null) {
        throw validationError("value must be a JSON object.", "invalid_value");
      }

      const value = validateSettingsValue(key, body.value);

      const { data, error } = await supabase
        .from("app_settings")
        .update({ value, updated_by: ctx.user.id })
        .eq("key", key)
        .select("key, value, description, updated_at")
        .single();
      if (error) {
        if (error.code === "PGRST116") {
          const notFound = new Error("Unknown settings key.");
          notFound.statusCode = 404;
          notFound.code = "settings_not_found";
          throw notFound;
        }
        throw error;
      }

      await logAudit(ctx, "settings.update", "app_settings", key, { value });
      json(res, 200, { setting: data });
      return;
    }

    methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    handleError(res, error);
  }
};
