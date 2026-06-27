"use strict";

// Tests for wholesale account access: an authenticated customer with an active
// grant receives wholesale pricing WITHOUT an access code, while guests still
// need a valid access code. No network, no Stripe, no real Supabase — a small
// in-memory fake exercises the same query chains the resolver uses.

const test = require("node:test");
const assert = require("node:assert/strict");

// The access-code path hashes codes with this secret. Set it before requiring
// the module so hashAccessCode() works for the access-code test.
process.env.ATHLETONIC_PRIVATE_PRICING_SECRET =
  process.env.ATHLETONIC_PRIVATE_PRICING_SECRET ||
  "test-private-pricing-secret-please-rotate";

const {
  applyPrivatePricing,
  hashAccessCode,
  resolvePrivatePricingGrant,
} = require("../api/_lib/private-pricing.js");

// ---------------------------------------------------------------------------
// Minimal chainable fake of the Supabase client. Supports the exact subset of
// the query builder used by the private-pricing resolver and access log.
// ---------------------------------------------------------------------------
function createFakeSupabase(initial) {
  const state = {
    private_pricing_grants: (initial.private_pricing_grants || []).map((row) => ({
      ...row,
    })),
    private_pricing_access_log: [],
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this._count = false;
      this._insert = null;
      this._update = null;
    }

    select(_cols, opts) {
      if (opts && opts.count) this._count = true;
      return this;
    }

    insert(row) {
      this._insert = row;
      return this;
    }

    update(patch) {
      this._update = patch;
      return this;
    }

    eq(col, val) {
      this.filters.push(["eq", col, val]);
      return this;
    }

    is(col, val) {
      this.filters.push(["is", col, val]);
      return this;
    }

    gte() {
      // Time-window filter for the access log; the fake keeps all rows.
      return this;
    }

    rows() {
      let rows = state[this.table] || [];
      for (const [op, col, val] of this.filters) {
        if (op === "eq") rows = rows.filter((r) => r[col] === val);
        if (op === "is") rows = rows.filter((r) => r[col] == null && val === null);
      }
      return rows;
    }

    async maybeSingle() {
      return { data: this.rows()[0] || null, error: null };
    }

    async single() {
      return { data: this.rows()[0] || null, error: null };
    }

    then(resolve, reject) {
      Promise.resolve()
        .then(() => {
          if (this._insert) {
            const arr = state[this.table] || (state[this.table] = []);
            const incoming = Array.isArray(this._insert)
              ? this._insert
              : [this._insert];
            for (const row of incoming) arr.push({ ...row });
            return { data: null, error: null };
          }
          if (this._update) {
            const matched = this.rows();
            for (const row of matched) Object.assign(row, this._update);
            return { data: matched, error: null };
          }
          if (this._count) {
            return { count: this.rows().length, error: null };
          }
          return { data: this.rows(), error: null };
        })
        .then(resolve, reject);
    }
  }

  return {
    state,
    from(table) {
      return new Query(table);
    },
  };
}

const SAMPLE_ITEMS = [
  {
    product_id: "p-protein",
    section_id: "protein",
    quantity: 2,
    unit_amount_cents: 5000,
  },
  {
    product_id: "p-gear",
    section_id: "lifting-gear",
    quantity: 1,
    unit_amount_cents: 4000,
  },
];

// supplements 5000bps on 10000 => 5000; rest 4000bps on 4000 => 1600.
const EXPECTED_DISCOUNT_CENTS = 5000 + 1600;

function futureIso() {
  return new Date(Date.now() + 86400000).toISOString();
}

function pastIso() {
  return new Date(Date.now() - 86400000).toISOString();
}

test("active grant linked by auth_user_id applies wholesale pricing without an access code", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-1",
        email: "buyer@example.com",
        status: "active",
        code_hash: "unused",
        code_hint: "1234",
        profile: "wholesale",
        expires_at: null,
        auth_user_id: "user-1",
      },
    ],
  });

  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "buyer@example.com",
    accessCode: null,
    authUserId: "user-1",
  });

  assert.ok(grant, "expected a grant for the authenticated account");
  assert.equal(grant.source, "account");
  assert.equal(grant.id, "grant-1");

  const pricing = applyPrivatePricing(SAMPLE_ITEMS, grant);
  assert.equal(pricing.discountCents, EXPECTED_DISCOUNT_CENTS);
  assert.equal(pricing.pricingContext.source, "account");
  assert.equal(pricing.pricingContext.mode, "private_access");
});

test("active grant matched by email backfills auth_user_id and applies pricing", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-2",
        email: "buyer@example.com",
        status: "active",
        code_hash: "unused",
        code_hint: "1234",
        profile: "wholesale",
        expires_at: futureIso(),
        auth_user_id: null,
      },
    ],
  });

  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "buyer@example.com",
    accessCode: null,
    authUserId: "user-2",
  });

  assert.ok(grant, "expected a grant matched by email");
  assert.equal(grant.source, "account");
  assert.equal(
    supabase.state.private_pricing_grants[0].auth_user_id,
    "user-2",
    "auth_user_id should be backfilled"
  );
});

test("a revoked grant never applies wholesale pricing", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-3",
        email: "buyer@example.com",
        status: "revoked",
        code_hash: "unused",
        code_hint: "1234",
        profile: "wholesale",
        expires_at: null,
        auth_user_id: "user-3",
      },
    ],
  });

  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "buyer@example.com",
    accessCode: null,
    authUserId: "user-3",
  });

  assert.equal(grant, null);
  const pricing = applyPrivatePricing(SAMPLE_ITEMS, grant);
  assert.equal(pricing.discountCents, 0);
});

test("an expired grant never applies wholesale pricing", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-4",
        email: "buyer@example.com",
        status: "active",
        code_hash: "unused",
        code_hint: "1234",
        profile: "wholesale",
        expires_at: pastIso(),
        auth_user_id: "user-4",
      },
    ],
  });

  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "buyer@example.com",
    accessCode: null,
    authUserId: "user-4",
  });

  assert.equal(grant, null);
});

test("an authenticated user cannot claim another account's grant via a spoofed email", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-5",
        email: "owner@example.com",
        status: "active",
        code_hash: "unused",
        code_hint: "1234",
        profile: "wholesale",
        expires_at: null,
        auth_user_id: "owner-user",
      },
    ],
  });

  // The handler forces email to the verified token identity. An attacker with
  // no grant resolves to nothing even though a grant exists for another email.
  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "attacker@example.com",
    accessCode: null,
    authUserId: "attacker-user",
  });

  assert.equal(grant, null);
  // The owner's grant is untouched.
  assert.equal(
    supabase.state.private_pricing_grants[0].auth_user_id,
    "owner-user"
  );
});

test("an existing access code still applies wholesale pricing for guests", async () => {
  const accessCode = "AC-ABCD-EFGH-IJKL";
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-6",
        email: "guest@example.com",
        status: "active",
        code_hash: hashAccessCode(accessCode),
        code_hint: "IJKL",
        profile: "wholesale",
        expires_at: null,
        usage_count: 0,
        auth_user_id: null,
      },
    ],
  });

  const grant = await resolvePrivatePricingGrant(supabase, {
    email: "guest@example.com",
    accessCode,
    authUserId: null,
  });

  assert.ok(grant, "expected the access-code grant to resolve");
  assert.equal(grant.source, "access_code");

  const pricing = applyPrivatePricing(SAMPLE_ITEMS, grant);
  assert.equal(pricing.discountCents, EXPECTED_DISCOUNT_CENTS);
  assert.equal(pricing.pricingContext.source, "access_code");
});

test("a wrong access code does not apply wholesale pricing", async () => {
  const supabase = createFakeSupabase({
    private_pricing_grants: [
      {
        id: "grant-7",
        email: "guest@example.com",
        status: "active",
        code_hash: hashAccessCode("AC-ABCD-EFGH-IJKL"),
        code_hint: "IJKL",
        profile: "wholesale",
        expires_at: null,
        usage_count: 0,
        auth_user_id: null,
      },
    ],
  });

  await assert.rejects(
    () =>
      resolvePrivatePricingGrant(supabase, {
        email: "guest@example.com",
        accessCode: "AC-0000-0000-0000",
        authUserId: null,
      }),
    (err) => {
      assert.equal(err.code, "invalid_access_code");
      return true;
    }
  );
});
