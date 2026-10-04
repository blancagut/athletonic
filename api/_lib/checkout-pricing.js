const { getShippingCents, getTaxCents, validateCartWithOverrides } = require("./catalog");
const { loadAppSettings } = require("./app-settings");
const {
  applyPrivatePricing,
  resolvePrivatePricingGrant,
} = require("./private-pricing");
const { kitDiscountFromLines } = require("./kit-discount");

async function buildCheckoutPricing(options) {
  const supabase = options.supabase || null;
  const privateGrant = await resolvePrivatePricingGrant(supabase, {
    email: options.email,
    accessCode: options.accessCode,
    clientIp: options.clientIp,
    authUserId: options.authUserId || null,
  });

  const { items, lineItems, subtotalCents, currency } = await validateCartWithOverrides(options.cart, {
    allowManualOrder: options.allowManualOrder === true,
    priceBasis: privateGrant ? "regular" : "current",
    supabase,
  });
  const privatePricing = applyPrivatePricing(items, privateGrant);
  const kitPricing = kitDiscountFromLines(options.cart, lineItems);
  const appSettings = await loadAppSettings(options.supabase, ["shipping", "tax"]);
  const shippingCents = getShippingCents(subtotalCents, appSettings.shipping);
  const discountCents = privatePricing.discountCents + kitPricing.discountCents;
  const taxCents = getTaxCents(subtotalCents, discountCents, appSettings.tax);
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
    kitDiscountCents: kitPricing.discountCents,
    totalCents,
    currency,
    privateGrant,
    pricingContext: {
      ...privatePricing.pricingContext,
      ...(kitPricing.discountCents ? {
        kit_lab_discount_bps: 1000,
        kit_lab_discount_cents: kitPricing.discountCents,
        kit_lab_groups: kitPricing.qualifyingGroups,
      } : {}),
    },
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
    kit_discount_cents: pricing.kitDiscountCents,
    total_cents: pricing.totalCents,
    currency: pricing.currency,
    access_pricing_applied: pricing.accessPricingApplied,
  };
}

module.exports = {
  buildCheckoutPricing,
  publicQuotePayload,
};
