const { getShippingCents, validateCart } = require("./catalog");
const {
  applyPrivatePricing,
  resolvePrivatePricingGrant,
} = require("./private-pricing");

async function buildCheckoutPricing(options) {
  const supabase = options.supabase || null;
  const privateGrant = await resolvePrivatePricingGrant(supabase, {
    email: options.email,
    accessCode: options.accessCode,
    clientIp: options.clientIp,
    authUserId: options.authUserId || null,
  });

  const { items, subtotalCents, currency } = validateCart(options.cart, {
    priceBasis: privateGrant ? "regular" : "current",
  });
  const privatePricing = applyPrivatePricing(items, privateGrant);
  const shippingCents = getShippingCents(subtotalCents);
  const taxCents = 0;
  const discountCents = privatePricing.discountCents;
  const totalCents = Math.max(
    0,
    subtotalCents + shippingCents + taxCents - discountCents
  );

  return {
    items,
    subtotalCents,
    shippingCents,
    taxCents,
    discountCents,
    totalCents,
    currency,
    privateGrant,
    pricingContext: privatePricing.pricingContext,
    lineDiscounts: privatePricing.lineDiscounts,
    accessPricingApplied: Boolean(privateGrant),
  };
}

function publicQuotePayload(pricing) {
  return {
    subtotal_cents: pricing.subtotalCents,
    shipping_cents: pricing.shippingCents,
    tax_cents: pricing.taxCents,
    discount_cents: pricing.discountCents,
    total_cents: pricing.totalCents,
    currency: pricing.currency,
    access_pricing_applied: pricing.accessPricingApplied,
  };
}

module.exports = {
  buildCheckoutPricing,
  publicQuotePayload,
};
