# Athletonic Admin Runbook

**Last updated:** 2026-06-21  
**Super admin owner:** renvagu1@icloud.com

---

## 1. Accessing the Admin Panel

**URL:** https://www.athletonic.com/pages/admin/login.html

1. Enter your authorized admin email and password.
2. Click **Sign in**.
3. The panel loads with your role-appropriate navigation.

**Role levels:**
- `super_admin` — full access including Users, Settings, Private Pricing, Audit Log.
- `admin` — access to Orders, Returns, Checkout Intents, Catalog, Dashboard.
- `user` — no admin access; access to `/api/admin/*` returns 403.

**Provision/reset super admin password:**
```bash
ATHLETONIC_SUPER_ADMIN_PASSWORD='...' python3 scripts/provision_super_admin.py renvagu1@icloud.com
```

---

## 2. Managing Orders

**In the panel:** Admin → Orders tab.

- Displays all orders with status, customer email, total, and fulfillment state.
- Click a row to open the order detail modal.
- Editable fields: fulfillment status, internal notes.

**API (authenticated):**
```
GET  /api/admin/orders          — paginated order list
GET  /api/admin/orders/:id      — single order detail
PATCH /api/admin/orders/:id     — update fulfillment_status, notes, tracking fields
```

**Order status lifecycle:** `pending_payment` → `paid` → `processing` → `shipped` → `delivered` / `cancelled` / `refunded`.

---

## 3. Updating Tracking

In the Orders detail modal (or via PATCH):

```json
{
  "tracking_number": "1Z999AA10123456784",
  "tracking_carrier": "UPS",
  "fulfillment_status": "shipped"
}
```

The customer can track via `GET /api/orders/lookup` (email + order reference).

---

## 4. Reviewing Returns

**In the panel:** Admin → Returns tab.

- Lists all return requests with resolution type, status, and customer email.
- Click a row to view submitted items, reason, and any uploaded photos.
- Editable field: `status` (pending → approved / rejected / completed).

**API:**
```
GET   /api/admin/returns        — paginated list
GET   /api/admin/returns/:id    — full detail including items + photos
PATCH /api/admin/returns/:id    — update status, internal notes
```

**Note:** Return photos are stored as private Supabase Storage paths. To view them, use the Supabase Storage console or generate a signed URL via the service role.

---

## 5. Reviewing Failed Checkout Intents

**In the panel:** Admin → Checkout Intents tab.

Shows top-of-funnel checkout records including:
- Email entered before payment.
- Cart contents (items, quantities, prices).
- Stripe session creation outcome.
- Timestamps.

These are created when a customer clicks "Continue to secure payment." Records remain even if they never completed payment. Use this to identify drop-off and re-engage customers.

**API:**
```
GET /api/admin/checkout-intents        — paginated list
GET /api/admin/checkout-intents/:id   — detail
```

---

## 6. Deploying

Athletonic is deployed to Vercel. Generated static files are committed to git.

**Standard deployment:**
```bash
# 1. Regenerate static pages if catalog/data changed
npm run generate

# 2. Review the diff
git diff --stat

# 3. Commit
git add -A
git commit -m "chore: regenerate static assets"

# 4. Push — Vercel auto-deploys from the connected branch
git push
```

**Verify deployment:**
```bash
npx vercel ls --prod    # shows Production deployments; check ● Ready
```

**Required Vercel environment variables (Production):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ATHLETONIC_SITE_URL` = `https://athletonic.com`
- `STRIPE_SECRET_KEY` ← **currently missing; add before accepting real payments**
- `STRIPE_WEBHOOK_SECRET` ← **currently missing; add and register webhook endpoint in Stripe dashboard**

---

## 7. Stripe Webhook Setup (Required Before Go-Live)

1. In Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://www.athletonic.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`
2. Copy the **Signing Secret** from the webhook detail page.
3. Add to Vercel: `STRIPE_WEBHOOK_SECRET` = `whsec_...`
4. Add `STRIPE_SECRET_KEY` = your Stripe secret key (starts with `sk_live_` for production, `sk_test_` for test mode).
5. Redeploy (push any commit) so new env vars take effect.

---

## 8. Admin Audit Log

**In the panel:** Admin → Audit Log tab (super_admin only).

Records every privileged action: role changes, settings updates, catalog mutations, order/return edits.

Fields: timestamp, actor email, actor role, action, target type, target ID, metadata.

**API:**
```
GET /api/admin/audit    — paginated, super_admin only
```

---

## 9. What the Owner Must Still Test Manually

These tasks require private inbox access, real credentials, or a payment card and cannot be automated:

1. **Admin password login** — sign in as `renvagu1@icloud.com`; confirm it lands on the admin panel; confirm role shows `Super admin`.
2. **Real purchase** — add item to cart, enter email, click "Continue to secure payment", complete Stripe checkout with a real or Stripe test card (`4242 4242 4242 4242`), confirm redirect to order-confirmation page.
3. **Webhook delivery** — after test purchase, check Stripe Dashboard → Webhooks → recent deliveries; confirm `checkout.session.completed` was received and the order appeared in Admin → Orders.
4. **Order confirmation email** — confirm customer email arrives after purchase from Resend. Default sender is `onboarding@resend.dev` until a custom sending domain is verified.
5. **Stripe env vars** — add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Vercel Production (see §6 and §7 above).
6. **Resend sending domain** — verify an Athletonic domain in Resend, then replace the default sender address.
7. **Supabase Auth** — confirm email/password sign-in is enabled and the super admin password has been reset.
8. **Supabase backup** — export or enable PITR if not already done.
9. **Final launch decision** — confirm all of the above before directing real traffic.

---

## 10. Quick Reference: Key URLs

| Resource | URL |
|---|---|
| Storefront | https://www.athletonic.com |
| Admin login | https://www.athletonic.com/pages/admin/login.html |
| Account | https://www.athletonic.com/pages/account.html |
| Order tracking | https://www.athletonic.com/pages/order-tracking.html |
| Returns | https://www.athletonic.com/pages/returns-request.html |
| Supabase console | https://app.supabase.com (project: spdvsaozvdcvztinsuex) |
| Vercel dashboard | https://vercel.com/ninja12max/athletonic |
| Stripe dashboard | https://dashboard.stripe.com |
