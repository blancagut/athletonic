# Athletonic Production Commerce Flow

This project now keeps product discovery inside Athletonic, creates payment sessions server-side, confirms payment only from verified Stripe webhooks, and stores real orders in Supabase.

## 1. Architecture

- Static storefront: `index.html`, `product/*.html`, `pages/*.html`, `assets/cart.js`.
- Vercel Functions:
  - `POST /api/checkout`
  - `POST /api/stripe-webhook`
  - `GET /api/orders/session?session_id=...`
  - `POST /api/orders/lookup`
  - `POST /api/returns/request`
- Stripe Checkout: real card payment, shipping address collection, optional automatic tax, success back to `pages/order-confirmation.html`.
- Supabase:
  - `checkout_intents` remains as top-of-funnel checkout analytics.
  - `orders` and `order_items` are the operational order record.
  - `order_status_events` is the customer-visible timeline.
  - `stripe_webhook_events` stores webhook idempotency and diagnostics.
  - `return_requests`, `return_request_items`, `return_request_photos` handle returns/replacements.
- Server catalog: `data/athletonic-catalog.json` is generated from the current Athletonic catalog and used by `/api/checkout` to recalculate item names/prices. The frontend never decides the payable amount.

## 2. Supabase SQL

Migration file:

```text
supabase/migrations/20260520120000_orders_payments_returns.sql
```

Core tables:

- `orders`: totals, email, Stripe IDs, payment status, fulfillment status, order status, shipping/tracking fields, timestamps.
- `order_items`: item snapshot with product id, name, brand, variant, quantity, unit amount, line subtotal.
- `order_status_events`: audit/timeline events.
- `stripe_webhook_events`: Stripe event id, type, payload, processed/error state.
- `return_requests`: requested resolution and return state.
- `return_request_items`: item quantities under return.
- `return_request_photos`: private Supabase Storage paths.

Order states:

```text
pending_payment, paid, processing, shipped, delivered, cancelled, refunded
```

Return states:

```text
requested, under_review, approved, rejected, received, refunded, replaced
```

Important RPCs:

- `create_pending_order(...)`: transactionally creates an order and items before redirecting to Stripe.
- `confirm_order_payment(...)`: called by the verified Stripe webhook to mark the order paid and store final Stripe amounts.
- `mark_order_checkout_cancelled(...)`: called on `checkout.session.expired`.

## 3. RLS / Security

- RLS is enabled on all new commerce tables.
- `anon` receives no direct table grants for orders or returns.
- `authenticated` customers can read their own rows when `user_id` exists; admins can read/update through `public.is_admin(auth.uid())`.
- Guest tracking and returns go through Vercel Functions using `SUPABASE_SERVICE_ROLE_KEY`, never through the browser.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` must never be exposed client-side.
- `return-photos` is a private Supabase Storage bucket; only service role upload and admin read are intended.

## 4. User Flow

1. Customer adds Athletonic products to cart.
2. Customer enters email and clicks secure payment.
3. `/api/checkout` validates email/cart and recalculates prices from `data/athletonic-catalog.json`.
4. Server creates `checkout_intents`, `orders`, and `order_items` with `pending_payment`.
5. Server creates Stripe Checkout Session and returns the Stripe URL.
6. Customer pays through Stripe Checkout.
7. Stripe redirects to `pages/order-confirmation.html?session_id=...`.
8. Stripe webhook `checkout.session.completed` verifies signature and calls `confirm_order_payment`.
9. Confirmation page reads order state; if webhook is still processing, it briefly polls.
10. Customer can track with email + `ATH-...` reference.
11. Customer can request refund/replacement with email + reference + item + reason + optional photos.

## 5. API Contract

### `POST /api/checkout`

Request:

```json
{
  "email": "customer@example.com",
  "cart": [
    { "productId": "1557", "variant": "", "quantity": 1 }
  ],
  "attribution": {
    "utm_source": "meta",
    "utm_campaign": "spring_launch",
    "fbclid": "..."
  }
}
```

Response:

```json
{
  "url": "https://checkout.stripe.com/...",
  "session_id": "cs_live_...",
  "order_reference": "ATH-ABC123DEF4",
  "subtotal_cents": 9899,
  "shipping_cents": 0,
  "tax_cents": 0,
  "total_cents": 9899,
  "currency": "USD"
}
```

### `POST /api/stripe-webhook`

Stripe sends events here. The function reads raw body, verifies `Stripe-Signature`, stores the event, and updates orders only after trusted Stripe confirmation.

### `GET /api/orders/session?session_id=cs_...`

Used by confirmation page to display the order tied to a Stripe Checkout Session.

### `POST /api/orders/lookup`

Request:

```json
{ "email": "customer@example.com", "order_reference": "ATH-ABC123DEF4" }
```

### `POST /api/returns/request`

Request:

```json
{
  "email": "customer@example.com",
  "order_reference": "ATH-ABC123DEF4",
  "requested_resolution": "replacement",
  "reason": "Damaged item",
  "items": [{ "order_item_id": "uuid", "quantity": 1 }],
  "photos": [{ "name": "damage.jpg", "type": "image/jpeg", "data": "data:image/jpeg;base64,..." }]
}
```

## 6. Stripe Checkout Session Example

Implemented in `api/checkout.js`.

```js
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  customer_email: customerEmail,
  client_reference_id: orderReference,
  line_items,
  shipping_address_collection: { allowed_countries: ["US"] },
  shipping_options,
  automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
  success_url: `${siteUrl}/pages/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${siteUrl}/?checkout=cancelled&order_reference=${orderReference}`,
  metadata: { order_id: orderId, order_reference: orderReference },
  payment_intent_data: {
    metadata: { order_id: orderId, order_reference: orderReference }
  }
});
```

## 7. Stripe Webhook Example

Implemented in `api/stripe-webhook.js`.

```js
const rawBody = await readRawBody(req);
const event = stripe.webhooks.constructEvent(
  rawBody,
  req.headers["stripe-signature"],
  process.env.STRIPE_WEBHOOK_SECRET
);

if (event.type === "checkout.session.completed") {
  const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
  if (session.payment_status === "paid") {
    await supabase.rpc("confirm_order_payment", { ... });
  }
}
```

## 8. Frontend

- `assets/cart.js`: sends email/cart to `/api/checkout` and redirects to Stripe Checkout.
- `assets/order-confirmation.js`: reads `session_id`, displays totals/items/timeline.
- `assets/order-tracking.js`: looks up order by email + reference.
- `assets/returns-request.js`: finds order, lets customer choose item/reason/resolution/photos, submits return request.

## 9. Files Created / Modified

Created:

- `api/_lib/catalog.js`
- `api/_lib/http.js`
- `api/_lib/orders.js`
- `api/_lib/stripe.js`
- `api/_lib/supabase.js`
- `api/checkout.js`
- `api/orders/lookup.js`
- `api/orders/session.js`
- `api/returns/request.js`
- `api/stripe-webhook.js`
- `assets/order-confirmation.js`
- `assets/order-tracking.js`
- `assets/returns-request.js`
- `data/athletonic-catalog.json`
- `docs/PRODUCTION_COMMERCE_FLOW.md`
- `.env.example`
- `package.json`
- `pages/order-confirmation.html`
- `pages/order-tracking.html`
- `pages/returns-request.html`
- `supabase/migrations/20260520120000_orders_payments_returns.sql`

Modified:

- `assets/cart.js`
- `index.html`
- `pages/orders.html`
- `pages/returns.html`
- `scripts/generate-home.mjs`
- `src/source-of-truth/athletonic.mjs`
- `styles.css`
- `vercel.json`

## 10. Production Checklist Before Meta Ads

- Apply Supabase migrations in production.
- Set Vercel env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `ATHLETONIC_SITE_URL=https://athletonic.com`
  - optional `STRIPE_AUTOMATIC_TAX=true`
  - optional `STRIPE_SHIPPING_RATE_ID` or `ATHLETONIC_SHIPPING_AMOUNT_CENTS`
  - optional `ATHLETONIC_FREE_SHIPPING_MIN_CENTS`
  - optional `ATHLETONIC_SHIPPING_COUNTRIES=US`
- Configure Stripe webhook endpoint:
  - URL: `https://athletonic.com/api/stripe-webhook`
  - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
- Enable Stripe Tax if `STRIPE_AUTOMATIC_TAX=true`.
- Test with Stripe test mode card and verify:
  - order starts `pending_payment`
  - webhook marks `paid`
  - confirmation page clears cart
  - tracking lookup works
  - return request creates `RET-...`
- Confirm emails/receipts in Stripe Dashboard.
- Add fulfillment/admin workflow for moving orders to `processing`, `shipped`, `delivered`.
- Add privacy/cookie consent and Meta Pixel/CAPI plan before scaling campaigns.
- Verify product prices in `data/athletonic-catalog.json` before every deployment.
- Run a real $1 live-mode payment before launching ads.
