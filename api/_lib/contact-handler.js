"use strict";

const { normalizeContactMessage } = require("./contact-message");
const { sendContactMessageEmail } = require("./email");
const { getClientIp, handleError, json, methodNotAllowed, readJson, requireEnv } = require("./http");

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const MAX_RATE_LIMIT_KEYS = 2000;
const attemptsByIp = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  for (const [key, timestamps] of attemptsByIp) {
    const current = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (current.length) attemptsByIp.set(key, current);
    else attemptsByIp.delete(key);
  }

  const key = String(ip || "unknown").slice(0, 80);
  const recent = attemptsByIp.get(key) || [];
  if (recent.length >= RATE_LIMIT_MAX) {
    const error = new Error("Too many messages. Please try again later.");
    error.statusCode = 429;
    error.code = "contact_rate_limited";
    throw error;
  }
  if (!attemptsByIp.has(key) && attemptsByIp.size >= MAX_RATE_LIMIT_KEYS) {
    attemptsByIp.delete(attemptsByIp.keys().next().value);
  }
  recent.push(now);
  attemptsByIp.set(key, recent);
}

module.exports = async function handleContactMessage(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  try {
    const body = await readJson(req, 12 * 1024);
    if (String(body.company || "").trim()) {
      json(res, 200, { ok: true });
      return;
    }

    checkRateLimit(getClientIp(req));
    requireEnv(["RESEND_API_KEY", "ATHLETONIC_CONTACT_TO_EMAIL"]);
    const message = normalizeContactMessage(body);
    await sendContactMessageEmail({
      ...message,
      recipientEmail: process.env.ATHLETONIC_CONTACT_TO_EMAIL,
    });

    json(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
};
