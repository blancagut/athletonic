const { Resend } = require("resend");
const { requireEnv } = require("./http");

let cachedResend;

function getResend() {
  requireEnv(["RESEND_API_KEY"]);

  if (!cachedResend) {
    cachedResend = new Resend(process.env.RESEND_API_KEY);
  }

  return cachedResend;
}

module.exports = { getResend };
