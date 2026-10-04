"use strict";

const { normalizeEmail } = require("./validation");

const TOPICS = {
  general: "General question",
  order: "Order, shipping, or return",
  wholesale: "Wholesale buying",
  partnership: "Business or partnership",
  privacy: "Privacy request",
};

function invalid(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function normalizeContactMessage(body) {
  const formStartedAt = Number(body?.form_started_at);
  const elapsedMs = Date.now() - formStartedAt;
  if (!Number.isFinite(formStartedAt) || elapsedMs < 2500 || elapsedMs > 2 * 24 * 60 * 60 * 1000) {
    throw invalid("Please wait a moment and submit the form again.", "invalid_submission_timing");
  }

  const name = String(body?.name || "").trim();
  if (name.length < 2 || name.length > 120) throw invalid("Enter your name.", "invalid_name");

  const email = normalizeEmail(body?.email);
  if (email.length > 254) throw invalid("Enter a valid email address.", "invalid_email");

  const topic = String(body?.topic || "").trim();
  if (!Object.hasOwn(TOPICS, topic)) throw invalid("Choose a message topic.", "invalid_topic");

  const message = String(body?.message || "").trim();
  if (message.length < 10 || message.length > 4000) throw invalid("Write a message between 10 and 4,000 characters.", "invalid_message");

  const orderReference = String(body?.order_reference || "").trim().slice(0, 80);
  return { name, email, topic, topicLabel: TOPICS[topic], message, orderReference };
}

module.exports = { normalizeContactMessage, TOPICS };
