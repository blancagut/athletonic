const MAX_JSON_BYTES = 1024 * 1024;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  json(res, 405, { error: "method_not_allowed" });
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function getSiteUrl(req) {
  return (process.env.ATHLETONIC_SITE_URL || getOrigin(req)).replace(/\/$/, "");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (!forwarded) return null;
  return String(forwarded).split(",")[0].trim() || null;
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const error = new Error(`Missing environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    error.code = "missing_env";
    throw error;
  }
}

async function readRawBody(req, limitBytes = MAX_JSON_BYTES) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      error.code = "body_too_large";
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function readJson(req, limitBytes = MAX_JSON_BYTES) {
  const raw = await readRawBody(req, limitBytes);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    error.code = "invalid_json";
    throw error;
  }
}

function handleError(res, error) {
  const statusCode = error.statusCode || 500;
  const code = error.code || (statusCode >= 500 ? "server_error" : "bad_request");
  const message =
    statusCode >= 500 ? "We could not complete this request right now." : error.message;

  if (statusCode >= 500) console.error(error);
  json(res, statusCode, { error: code, message });
}

module.exports = {
  getClientIp,
  getSiteUrl,
  handleError,
  json,
  methodNotAllowed,
  readJson,
  readRawBody,
  requireEnv,
};
