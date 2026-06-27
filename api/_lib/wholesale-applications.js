const { normalizeEmail } = require("./catalog");

const WHOLESALE_APPLICATION_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
];

const WHOLESALE_BUSINESS_TYPES = [
  "retail_store",
  "gym_studio",
  "coach_team",
  "distributor",
  "corporate_wellness",
  "other",
];

const WHOLESALE_PRODUCT_INTERESTS = [
  "protein",
  "creatine",
  "pre_workout",
  "hydration",
  "vitamins_wellness",
  "bars_shakes",
  "recovery_devices",
  "apparel",
  "footwear",
  "accessories_gear",
];

const YEARS_IN_BUSINESS = [
  "pre_launch",
  "under_1_year",
  "1_2_years",
  "3_5_years",
  "6_10_years",
  "10_plus_years",
];

const INVESTMENT_BUDGETS_USD = [
  "under_1000",
  "1000_5000",
  "5000_15000",
  "15000_50000",
  "50000_plus",
];

const IMPORT_EXPERIENCE_LEVELS = [
  "none",
  "domestic_only",
  "imported_before",
  "currently_importing",
];

const SALES_CHANNELS = [
  "retail_store",
  "gym_members",
  "online_store",
  "marketplace",
  "events",
  "mixed",
  "other",
];

const CUSTOMER_REACH_LEVELS = [
  "under_100",
  "100_500",
  "500_2500",
  "2500_10000",
  "10000_plus",
];

const ORDER_FREQUENCIES = [
  "one_time",
  "monthly",
  "twice_monthly",
  "weekly",
  "as_needed",
];

const FULFILLMENT_SETUPS = [
  "store_pick_pack",
  "warehouse",
  "third_party_logistics",
  "dropship",
  "not_set",
];

const ATHLETONIC_OFFICE_ADDRESS = {
  line1: "127 North Higgins Avenue",
  city: "Missoula",
  region: "MT",
  postal_code: "59802",
  country: "US",
};

const ATHLETONIC_OFFICE_ADDRESS_TEXT =
  "127 North Higgins Avenue, Missoula, MT 59802";

function validationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code || "invalid_input";
  return error;
}

function cleanText(value, maxLength, options = {}) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  if (options.required && !cleaned) {
    throw validationError(options.message || "This field is required.", options.code);
  }
  return cleaned || null;
}

function cleanLongText(value, maxLength, options = {}) {
  const cleaned = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
  if (options.required && !cleaned) {
    throw validationError(options.message || "This field is required.", options.code);
  }
  return cleaned || null;
}

function normalizeBusinessType(value) {
  const normalized = cleanText(value, 80, {
    required: true,
    message: "Select a business type.",
    code: "missing_business_type",
  })
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return WHOLESALE_BUSINESS_TYPES.includes(normalized) ? normalized : "other";
}

function normalizeEnum(value, allowed, fallback, options = {}) {
  const normalized = cleanText(value, 80, {
    required: options.required,
    message: options.message,
    code: options.code,
  });
  if (!normalized) return fallback || null;
  const safe = normalized
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (allowed.includes(safe)) return safe;
  if (options.required && !fallback) {
    throw validationError(options.message || "Select a valid option.", options.code || "invalid_selection");
  }
  return fallback || null;
}

function normalizeDesiredProducts(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  const products = Array.from(new Set(
    raw
      .map((entry) => normalizeEnum(entry, WHOLESALE_PRODUCT_INTERESTS, null))
      .filter(Boolean)
  ));
  if (products.length === 0) {
    throw validationError("Select at least one product category.", "missing_desired_products");
  }
  return products;
}

function normalizeWebsite(value) {
  const raw = cleanText(value, 300);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().slice(0, 300);
  } catch {
    throw validationError("Enter a valid website or social URL.", "invalid_website");
  }
}

function normalizePhone(value) {
  return cleanText(value, 40, {
    required: true,
    message: "Enter a business phone number.",
    code: "missing_phone",
  });
}

function normalizeVolume(value) {
  const normalized = cleanText(value, 80, {
    required: true,
    message: "Select an expected monthly order volume.",
    code: "missing_monthly_volume",
  });
  return normalized;
}

function normalizeWholesaleApplication(body) {
  if (String(body.website || "").trim() !== "") {
    return { honeypot: true };
  }

  const consent = body.consent === true || String(body.consent || "") === "on";
  if (!consent) {
    throw validationError("Confirm that the application information is accurate.", "missing_consent");
  }

  return {
    email: normalizeEmail(body.email),
    full_name: cleanText(body.full_name, 160, {
      required: true,
      message: "Enter your full name.",
      code: "missing_full_name",
    }),
    company_name: cleanText(body.company_name, 180, {
      required: true,
      message: "Enter the business or organization name.",
      code: "missing_company_name",
    }),
    business_type: normalizeBusinessType(body.business_type),
    years_in_business: normalizeEnum(body.years_in_business, YEARS_IN_BUSINESS, null, {
      required: true,
      message: "Select how long you have been in business.",
      code: "missing_years_in_business",
    }),
    phone: normalizePhone(body.phone),
    website_url: normalizeWebsite(body.website_url),
    address_line1: cleanText(body.address_line1, 180, {
      required: true,
      message: "Enter the business street address.",
      code: "missing_address",
    }),
    address_line2: cleanText(body.address_line2, 180),
    city: cleanText(body.city, 120, {
      required: true,
      message: "Enter the business city.",
      code: "missing_city",
    }),
    region: cleanText(body.region, 80, {
      required: true,
      message: "Enter the state or region.",
      code: "missing_region",
    }),
    postal_code: cleanText(body.postal_code, 30, {
      required: true,
      message: "Enter the postal code.",
      code: "missing_postal_code",
    }),
    country: cleanText(body.country || "US", 80, {
      required: true,
      message: "Enter the country.",
      code: "missing_country",
    }),
    desired_products: normalizeDesiredProducts(body.desired_products),
    investment_budget_usd: normalizeEnum(body.investment_budget_usd, INVESTMENT_BUDGETS_USD, null, {
      required: true,
      message: "Select how much you want to invest in USD.",
      code: "missing_investment_budget",
    }),
    import_experience: normalizeEnum(body.import_experience, IMPORT_EXPERIENCE_LEVELS, null, {
      required: true,
      message: "Select your import experience.",
      code: "missing_import_experience",
    }),
    sales_channel: normalizeEnum(body.sales_channel, SALES_CHANNELS, "other", {
      required: true,
      message: "Select your primary sales channel.",
      code: "missing_sales_channel",
    }),
    customer_reach: normalizeEnum(body.customer_reach, CUSTOMER_REACH_LEVELS, null, {
      required: true,
      message: "Select your monthly customer reach.",
      code: "missing_customer_reach",
    }),
    order_frequency: normalizeEnum(body.order_frequency, ORDER_FREQUENCIES, null, {
      required: true,
      message: "Select your expected order frequency.",
      code: "missing_order_frequency",
    }),
    sales_regions: cleanText(body.sales_regions, 300, {
      required: true,
      message: "Enter your sales regions.",
      code: "missing_sales_regions",
    }),
    fulfillment_setup: normalizeEnum(body.fulfillment_setup, FULFILLMENT_SETUPS, null, {
      required: true,
      message: "Select your fulfillment setup.",
      code: "missing_fulfillment_setup",
    }),
    reseller_or_tax_id: cleanText(body.reseller_or_tax_id, 120),
    monthly_volume: normalizeVolume(body.monthly_volume),
    product_interest: cleanLongText(body.product_interest, 1200, {
      required: true,
      message: "Tell us which product categories you are interested in.",
      code: "missing_product_interest",
    }),
    business_plan: cleanLongText(body.business_plan, 1800, {
      required: true,
      message: "Tell us how you plan to use wholesale access.",
      code: "missing_business_plan",
    }),
    notes: cleanLongText(body.notes, 1200),
    source_page: cleanText(body.source_page, 500),
    metadata: {
      submitted_timezone: cleanText(body.submitted_timezone, 120),
    },
  };
}

function normalizeDecision(body) {
  const action = cleanText(body.action, 40, {
    required: true,
    message: "Choose a review action.",
    code: "missing_action",
  });
  if (!["under_review", "approve", "reject"].includes(action)) {
    throw validationError("Unsupported review action.", "invalid_action");
  }

  const decisionNotes = cleanLongText(body.decision_notes, 2000);
  if (action === "reject" && !decisionNotes) {
    throw validationError("Add decision notes before rejecting an application.", "missing_decision_notes");
  }

  return {
    action,
    decision_notes: decisionNotes,
    profile: cleanText(body.profile || "wholesale", 80) || "wholesale",
  };
}

module.exports = {
  ATHLETONIC_OFFICE_ADDRESS,
  ATHLETONIC_OFFICE_ADDRESS_TEXT,
  CUSTOMER_REACH_LEVELS,
  FULFILLMENT_SETUPS,
  IMPORT_EXPERIENCE_LEVELS,
  INVESTMENT_BUDGETS_USD,
  ORDER_FREQUENCIES,
  SALES_CHANNELS,
  WHOLESALE_APPLICATION_STATUSES,
  WHOLESALE_BUSINESS_TYPES,
  WHOLESALE_PRODUCT_INTERESTS,
  YEARS_IN_BUSINESS,
  normalizeDecision,
  normalizeWholesaleApplication,
};
