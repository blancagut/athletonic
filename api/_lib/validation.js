const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    const error = new Error("Enter a valid email address.");
    error.statusCode = 400;
    error.code = "invalid_email";
    throw error;
  }
  return normalized;
}

function normalizeAttribution(attribution) {
  if (!attribution || typeof attribution !== "object" || Array.isArray(attribution)) {
    return {};
  }

  const allowedKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "fbclid",
    "fbp",
    "fbc",
    "landing_page",
    "referrer",
    "client_timezone",
  ];

  const clean = {};
  for (const key of allowedKeys) {
    const value = attribution[key];
    if (typeof value === "string" && value.trim()) {
      clean[key] = value.trim().slice(0, 500);
    }
  }

  return clean;
}

module.exports = {
  normalizeAttribution,
  normalizeEmail,
};
