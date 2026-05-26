const Stripe = require("stripe");
const { requireEnv } = require("./http");

let cachedStripe;

function getStripe() {
  requireEnv(["STRIPE_SECRET_KEY"]);

  if (!cachedStripe) {
    cachedStripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || "2026-02-25.clover",
    });
  }

  return cachedStripe;
}

module.exports = { getStripe };
