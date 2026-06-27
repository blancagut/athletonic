"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ATHLETONIC_OFFICE_ADDRESS_TEXT,
  normalizeDecision,
  normalizeWholesaleApplication,
} = require("../api/_lib/wholesale-applications");

function validBody(overrides = {}) {
  return {
    full_name: "Renee Buyer",
    email: "Renee@Example.com ",
    phone: "+1 406 555 0100",
    website: "",
    website_url: "example.com",
    company_name: "Peak Gym",
    business_type: "gym_studio",
    years_in_business: "3_5_years",
    address_line1: "10 Main Street",
    address_line2: "",
    city: "Missoula",
    region: "MT",
    postal_code: "59802",
    country: "US",
    desired_products: ["protein", "hydration"],
    investment_budget_usd: "5000_15000",
    import_experience: "imported_before",
    sales_channel: "gym_members",
    customer_reach: "500_2500",
    order_frequency: "monthly",
    sales_regions: "Montana and online US",
    fulfillment_setup: "store_pick_pack",
    reseller_or_tax_id: "MT-123",
    monthly_volume: "500_2500",
    product_interest: "Protein and hydration",
    business_plan: "Member recovery and nutrition shelf.",
    notes: "Open seven days.",
    consent: true,
    ...overrides,
  };
}

test("normalizes a complete wholesale application", () => {
  const app = normalizeWholesaleApplication(validBody());
  assert.equal(app.email, "renee@example.com");
  assert.equal(app.business_type, "gym_studio");
  assert.equal(app.website_url, "https://example.com/");
  assert.equal(app.company_name, "Peak Gym");
  assert.equal(app.years_in_business, "3_5_years");
  assert.deepEqual(app.desired_products, ["protein", "hydration"]);
  assert.equal(app.investment_budget_usd, "5000_15000");
  assert.equal(app.import_experience, "imported_before");
  assert.equal(app.sales_channel, "gym_members");
  assert.equal(app.customer_reach, "500_2500");
  assert.equal(app.order_frequency, "monthly");
  assert.equal(app.sales_regions, "Montana and online US");
  assert.equal(app.fulfillment_setup, "store_pick_pack");
  assert.equal(app.reseller_or_tax_id, "MT-123");
});

test("honeypot returns a silent marker", () => {
  const app = normalizeWholesaleApplication(validBody({ website: "bot-fill" }));
  assert.deepEqual(app, { honeypot: true });
});

test("missing consent is rejected", () => {
  assert.throws(
    () => normalizeWholesaleApplication(validBody({ consent: false })),
    (err) => {
      assert.equal(err.code, "missing_consent");
      return true;
    }
  );
});

test("missing desired products are rejected", () => {
  assert.throws(
    () => normalizeWholesaleApplication(validBody({ desired_products: [] })),
    (err) => {
      assert.equal(err.code, "missing_desired_products");
      return true;
    }
  );
});

test("invalid required qualification options are rejected", () => {
  assert.throws(
    () => normalizeWholesaleApplication(validBody({ investment_budget_usd: "not_real" })),
    (err) => {
      assert.equal(err.code, "missing_investment_budget");
      return true;
    }
  );
});

test("reject decisions require notes", () => {
  assert.throws(
    () => normalizeDecision({ action: "reject", decision_notes: "" }),
    (err) => {
      assert.equal(err.code, "missing_decision_notes");
      return true;
    }
  );
});

test("office address is available for application and email copy", () => {
  assert.equal(ATHLETONIC_OFFICE_ADDRESS_TEXT, "127 North Higgins Avenue, Missoula, MT 59802");
});
