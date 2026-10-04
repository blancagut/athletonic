const crypto = require("crypto");

const SUPPLEMENT_SECTION_IDS = new Set([
  "protein",
  "creatine",
  "pre-workout",
  "hydration",
  "vitamins",
  "greens",
  "bars-shakes",
  "sleep",
]);
const COMBAT_SECTION_IDS = new Set([
  "combat-sports",
  "muay-thai",
  "muaythai-mma",
  "boxing",
  "martial-arts",
]);

const PRIVATE_PRICING_RULES_VERSION = "private_pricing_v1";
const SUPPLEMENT_DISCOUNT_BPS = 5000;
const DEFAULT_DISCOUNT_BPS = 4000;
const FAILED_ATTEMPT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 8;

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_access_code";
  return error;
}

function privatePricingUnavailable() {
  return validationError("Access code could not be applied.", "invalid_access_code");
}

function normalizeAccessCode(code) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function accessCodeProvided(code) {
  return normalizeAccessCode(code).length > 0;
}

function requirePrivatePricingSecret() {
  const secret = process.env.ATHLETONIC_PRIVATE_PRICING_SECRET;
  if (!secret || secret.length < 24) {
    const error = new Error("Missing environment variables: ATHLETONIC_PRIVATE_PRICING_SECRET");
    error.statusCode = 500;
    error.code = "missing_env";
    throw error;
  }
  return secret;
}

function hashAccessCode(code) {
  const normalized = normalizeAccessCode(code);
  if (normalized.length < 12 || normalized.length > 80) {
    throw privatePricingUnavailable();
  }
  return crypto
    .createHmac("sha256", requirePrivatePricingSecret())
    .update(normalized)
    .digest("hex");
}

function codeHint(code) {
  const normalized = normalizeAccessCode(code).replace(/[^A-Z0-9]/g, "");
  return normalized.slice(-4);
}

function generateAccessCode() {
  const raw = crypto.randomBytes(12).toString("hex").toUpperCase();
  return `AC-${raw.match(/.{1,4}/g).join("-")}`;
}

function sanitizeProfile(profile) {
  const value = String(profile || "private_access")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return value || "private_access";
}

async function recordAccessAttempt(supabase, values) {
  try {
    await supabase.from("private_pricing_access_log").insert({
      grant_id: values.grant_id || null,
      email: values.email,
      client_ip: values.client_ip || null,
      success: Boolean(values.success),
      reason: values.reason || null,
    });
  } catch (error) {
    console.error("private_pricing_access_log_failed", error);
  }
}

async function assertAttemptLimit(supabase, email, clientIp) {
  const since = new Date(
    Date.now() - FAILED_ATTEMPT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count: emailCount, error: emailError } = await supabase
    .from("private_pricing_access_log")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since);
  if (emailError) throw emailError;

  let ipCount = 0;
  if (clientIp) {
    const { count, error } = await supabase
      .from("private_pricing_access_log")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", clientIp)
      .eq("success", false)
      .gte("created_at", since);
    if (error) throw error;
    ipCount = count || 0;
  }

  if ((emailCount || 0) >= MAX_FAILED_ATTEMPTS || ipCount >= MAX_FAILED_ATTEMPTS) {
    const error = privatePricingUnavailable();
    error.statusCode = 429;
    error.code = "access_code_rate_limited";
    throw error;
  }
}

async function verifyPrivatePricingGrant(supabase, options) {
  const email = options.email;
  const code = options.accessCode;
  const clientIp = options.clientIp || null;

  if (!accessCodeProvided(code)) return null;

  await assertAttemptLimit(supabase, email, clientIp);

  let codeHash;
  try {
    codeHash = hashAccessCode(code);
  } catch (error) {
    await recordAccessAttempt(supabase, {
      email,
      client_ip: clientIp,
      success: false,
      reason: "invalid_format",
    });
    throw error;
  }

  const { data: grant, error } = await supabase
    .from("private_pricing_grants")
    .select("id, email, status, code_hash, code_hint, profile, expires_at, usage_count")
    .eq("email", email)
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;

  const expiresAt = grant && grant.expires_at ? Date.parse(grant.expires_at) : null;
  const active =
    grant &&
    grant.status === "active" &&
    (!expiresAt || (Number.isFinite(expiresAt) && expiresAt > Date.now()));

  await recordAccessAttempt(supabase, {
    grant_id: grant ? grant.id : null,
    email,
    client_ip: clientIp,
    success: Boolean(active),
    reason: active ? "matched" : "not_matched",
  });

  if (!active) throw privatePricingUnavailable();

  return {
    id: grant.id,
    email: grant.email,
    profile: grant.profile || "private_access",
    code_hint: grant.code_hint || null,
    source: "access_code",
  };
}

function grantIsActive(grant) {
  if (!grant || grant.status !== "active") return false;
  const expiresAt = grant.expires_at ? Date.parse(grant.expires_at) : null;
  return !expiresAt || (Number.isFinite(expiresAt) && expiresAt > Date.now());
}

/**
 * Resolve an active wholesale grant for an authenticated account, without
 * requiring an access code. Looks up by linked auth_user_id first, then by
 * email. When matched by email and the grant is not yet linked to the auth
 * account, the auth_user_id is backfilled so future lookups are direct.
 * Does NOT require ATHLETONIC_PRIVATE_PRICING_SECRET.
 */
async function findAccountPrivatePricingGrant(supabase, options) {
  const authUserId = options.authUserId || null;
  const email = options.email || null;
  if (!authUserId) return null;

  const selectColumns =
    "id, email, status, code_hint, profile, expires_at, auth_user_id";

  let grant = null;
  let matchedByEmail = false;

  const byUser = await supabase
    .from("private_pricing_grants")
    .select(selectColumns)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (byUser.error) throw byUser.error;
  grant = byUser.data || null;

  if (!grant && email) {
    const byEmail = await supabase
      .from("private_pricing_grants")
      .select(selectColumns)
      .eq("email", email)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    grant = byEmail.data || null;
    matchedByEmail = Boolean(grant);
  }

  if (!grantIsActive(grant)) return null;

  if (matchedByEmail && !grant.auth_user_id) {
    const { error } = await supabase
      .from("private_pricing_grants")
      .update({ auth_user_id: authUserId })
      .eq("id", grant.id)
      .is("auth_user_id", null);
    if (!error) grant.auth_user_id = authUserId;
  }

  return {
    id: grant.id,
    email: grant.email,
    profile: grant.profile || "private_access",
    code_hint: grant.code_hint || null,
    auth_user_id: grant.auth_user_id || authUserId,
    source: "account",
  };
}

/**
 * Resolve the private pricing grant to apply for a checkout/quote.
 *  - If an access code is provided, use the existing access-code flow.
 *  - Otherwise, if the request is authenticated, look up an active grant
 *    linked to the account (by auth_user_id or email).
 * Returns null when no grant applies.
 */
async function resolvePrivatePricingGrant(supabase, options) {
  if (!supabase) return null;
  const accessCode = options.accessCode;

  if (accessCodeProvided(accessCode)) {
    return verifyPrivatePricingGrant(supabase, {
      email: options.email,
      accessCode,
      clientIp: options.clientIp,
    });
  }

  if (options.authUserId) {
    return findAccountPrivatePricingGrant(supabase, {
      authUserId: options.authUserId,
      email: options.email,
    });
  }

  return null;
}

async function recordPrivatePricingUsage(supabase, grantId) {
  if (!grantId) return;
  const { error } = await supabase.rpc("increment_private_pricing_usage", {
    p_grant_id: grantId,
  });
  if (error && error.code === "42883") {
    const fallback = await supabase
      .from("private_pricing_grants")
      .select("usage_count")
      .eq("id", grantId)
      .single();
    if (fallback.error) throw fallback.error;
    await supabase
      .from("private_pricing_grants")
      .update({
        usage_count: Number(fallback.data.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", grantId);
    return;
  }
  if (error) throw error;
}

function discountBpsForSection(sectionId) {
  const normalized = String(sectionId || "").trim().toLowerCase();
  if (SUPPLEMENT_SECTION_IDS.has(normalized)) return SUPPLEMENT_DISCOUNT_BPS;
  if (COMBAT_SECTION_IDS.has(normalized)) return DEFAULT_DISCOUNT_BPS;
  return 0;
}

function applyPrivatePricing(items, grant) {
  if (!grant) {
    return {
      discountCents: 0,
      pricingContext: {},
      lineDiscounts: [],
    };
  }

  const lineDiscounts = items.map((item) => {
    const sectionId = item.section_id || item.product_snapshot?.section_id || "";
    const bps = discountBpsForSection(sectionId);
    const lineSubtotalCents = item.quantity * item.unit_amount_cents;
    const discountCents = Math.round((lineSubtotalCents * bps) / 10000);
    return {
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      section_id: sectionId,
      quantity: item.quantity,
      base_unit_amount_cents: item.unit_amount_cents,
      discount_bps: bps,
      discount_cents: discountCents,
    };
  });

  const discountCents = lineDiscounts.reduce(
    (sum, line) => sum + line.discount_cents,
    0
  );

  return {
    discountCents,
    lineDiscounts,
    pricingContext: {
      mode: "private_access",
      source: grant.source || "access_code",
      rules_version: PRIVATE_PRICING_RULES_VERSION,
      grant_id: grant.id,
      profile: grant.profile || "private_access",
      discount_cents: discountCents,
      line_discounts: lineDiscounts,
    },
  };
}

module.exports = {
  DEFAULT_DISCOUNT_BPS,
  COMBAT_SECTION_IDS,
  PRIVATE_PRICING_RULES_VERSION,
  SUPPLEMENT_DISCOUNT_BPS,
  accessCodeProvided,
  applyPrivatePricing,
  codeHint,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
  sanitizeProfile,
  verifyPrivatePricingGrant,
  findAccountPrivatePricingGrant,
  resolvePrivatePricingGrant,
  recordPrivatePricingUsage,
};
