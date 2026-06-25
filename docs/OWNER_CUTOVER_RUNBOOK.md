# Owner Cutover Runbook — `fix/checkout-purchasable`

Final pre-cutover handoff for the checkout fix branch. Every item below is an
**owner action** (things the agent cannot or must not do: set secrets, click
Deploy, push to `main`). Nothing here has been pushed, merged, or deployed.

Branch: `fix/checkout-purchasable` (local only, base = `origin/main` @ `1048e2dd33`).

---

## 1. What this branch changes (and what it deliberately does NOT)

Files changed vs `origin/main` (5 files):

| File | Why |
| --- | --- |
| `api/_lib/catalog.js` | F1: make V1 catalog sellable (`purchasable`/`ready_for_sale` default true unless explicitly false). Variant guard: reject a variant-required product with no chosen option; carry the chosen option label onto the order line + Stripe item. |
| `api/checkout.js` | F2: collapse the duplicate `/api/checkout` route to a re-export of the canonical `api/checkout/index.js`. |
| `assets/cart.js` | F4: read the checkout error response body once (was `json()` then `text()` → "body already read", masking the real error). |
| `tests/checkout.validate.test.js` | F3 + variant: runtime `validateCart` coverage (10 tests). |
| `package.json` | `npm test` now runs the runtime test, not just `node --check`. |

**Deliberately EXCLUDED from this release (unrelated newsletter work — keep OUT):**
`api/newsletter.js`, `api/_lib/email.js`, `api/_lib/resend.js`, the newsletter
hunks of `assets/cart.js`, modified `api/stripe-webhook.js`, and migration
`supabase/migrations/20260620171000_newsletter_subscribers.sql`. These remain
unstaged in the working tree. Also unrelated/untracked and harmless:
`data/search-index 2.json` (17 MB, git-ignored via `.vercelignore`; safe to
delete locally), `test-results/`, `tools/mint_admin_session.mjs`, doc files.

---

## 2. Vercel Production environment variables (set NAMES, never paste values here)

Set these in **Vercel → Project → Settings → Environment Variables → Production**.
Values come from your `./.env` (do not commit them; do not share them in chat).

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`  (from the Stripe webhook endpoint you create in §3)
- `ATHLETONIC_SITE_URL` = `https://athletonic.com`  (no trailing slash)
- `ATHLETONIC_PRIVATE_PRICING_SECRET`  (≥ 24 random chars)

Shipping / tax (set the ones you use):
- `STRIPE_SHIPPING_RATE_ID`  **or**  `ATHLETONIC_SHIPPING_AMOUNT_CENTS`
- `ATHLETONIC_FREE_SHIPPING_MIN_CENTS`
- `ATHLETONIC_SHIPPING_COUNTRIES` = `US`
- `STRIPE_AUTOMATIC_TAX` (optional, `true`/`false`)

> Note: `.vercel/.env.production.local` in the repo has EMPTY values — ignore it;
> it is not the source of truth. Set values in the Vercel dashboard.

---

## 3. Stripe webhook (live mode)

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://athletonic.com/api/stripe-webhook`
3. Events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel (§2).

---

## 4. Supabase — confirm migrations are applied (project ref `spdvsaozvdcvztinsuex`)

Confirm these are applied in the production project (already applied through
`20260614120000` per prior verification):

- `20260506163554_auth_profiles.sql`
- `20260508152502_checkout_intents.sql`
- `20260508153128_harden_checkout_intents_insert_policy.sql`
- `20260508153545_submit_checkout_intent_rpc.sql`
- `20260520120000_orders_payments_returns.sql`
- `20260526124000_fix_order_reference_rng.sql`
- `20260530120000_super_admin.sql`
- `20260603130000_update_super_admin_email.sql`
- `20260603140000_revert_super_admin_email.sql`
- `20260610120000_harden_admin_profile_security.sql`
- `20260614120000_private_pricing.sql`

**Do NOT apply** `20260620171000_newsletter_subscribers.sql` — it belongs to the
excluded newsletter release.

Auth → URL configuration: ensure redirect URLs include the admin bridge
(`/pages/admin/index.html`) and the site origin `https://athletonic.com`.

---

## 5. Domain / DNS

- Add `athletonic.com` and `www.athletonic.com` to the Vercel project.
- Configure DNS per Vercel instructions; wait for valid HTTPS certs.
- Canonical host: `https://athletonic.com`; redirect the non-canonical host to it.

---

## 6. Pre-launch smoke test (Stripe TEST mode first)

1. Add a normal product to cart → checkout → Stripe test card `4242 4242 4242 4242`.
2. Order should be created `pending_payment`, then flip to `paid` after the
   webhook fires.
3. Confirmation page clears the cart; order tracking lookup works.
4. File a return → receive a `RET-…` reference.
5. **Variant product check:** open a product that says "Choose options", pick a
   flavor/size, add to cart, check out. Confirm the Stripe line item and the
   order line both show the chosen option label (e.g. "… - Cookies N Cream").
6. After test mode passes, switch to live keys and do **one** real $1-class
   payment before turning on any ad spend.

---

## 7. Merge / deploy plan — PREPARED, DO NOT EXECUTE

> Pushing `main` to GitHub (`blancagut/athletonic`) AUTO-DEPLOYS production via
> Vercel git integration. Do not run these until you explicitly decide to ship.

```bash
# 1. Make sure the newsletter work is NOT bundled (should list only the 5 files).
git diff --stat origin/main...fix/checkout-purchasable

# 2. Run the gate one more time.
npm test

# 3. Merge with a merge commit (keeps the fix grouped, easy to revert).
git checkout main
git pull origin main                     # ensure up to date
git merge --no-ff fix/checkout-purchasable

# 4. Ship (THIS triggers the Vercel production deploy).
git push origin main
```

Rollback if needed: `git revert -m 1 <merge-commit-sha> && git push origin main`
(re-deploys the previous good state), or use Vercel → Deployments → Promote a
prior production deployment.

---

## 8. Local gate result at handoff

- `npm test` → **10/10 pass** (validateCart: real price, client price ignored,
  invalid quantities, unknown id, empty cart, purchasable:false, unavailable,
  variant-required rejected w/o option, variant-required passes + carries label,
  distinct options stay separate lines).
- `node --check` → OK on `api/_lib/catalog.js`, `api/checkout.js`,
  `assets/cart.js`, `tests/checkout.validate.test.js`.
- `git diff --check` → clean (no whitespace/conflict markers).
- JSON valid → `package.json`, `vercel.json`, `data/athletonic-catalog.json`,
  `data/search-index.json`.
