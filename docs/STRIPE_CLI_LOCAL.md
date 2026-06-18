# Stripe CLI Local Setup

This project already creates Stripe Checkout Sessions in `api/checkout/index.js` and verifies Stripe webhook signatures in `api/stripe-webhook.js`. Use this flow to connect Stripe locally without exposing secrets in browser JavaScript.

## 1. Install and log in

The Stripe CLI is installed on this machine. If you need to authenticate or switch accounts:

```bash
npm run stripe:login
```

Use a Stripe sandbox/test account for local development.

## 2. Set local environment

Add these server-only values to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ATHLETONIC_SITE_URL=http://localhost:3000
```

Keep the existing Supabase server values too:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not add `sk_...`, `whsec_...`, or the Supabase service role key to HTML or client-side JavaScript.

## 3. Run the local app

Terminal 1:

```bash
npm run local
```

The app should be available at:

```text
http://localhost:3000
```

## 4. Forward Stripe webhooks

Terminal 2:

```bash
npm run stripe:listen
```

Stripe prints a signing secret that starts with `whsec_`. Put that value into `.env` as `STRIPE_WEBHOOK_SECRET`, then restart `npm run local` so the Vercel Functions load it.

This script forwards only the events this backend handles:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
```

## 5. Test the real checkout path

1. Open `http://localhost:3000`.
2. Add a product to the cart.
3. Enter an email and continue to secure payment.
4. Pay in Stripe Checkout with a test card:

```text
4242 4242 4242 4242
any future expiry
any 3-digit CVC
any billing ZIP
```

5. Confirm Terminal 2 shows a forwarded `checkout.session.completed` event.
6. Confirm Supabase changes the order from `pending_payment` / `pending` to `paid` / `paid`.

Avoid using `stripe trigger checkout.session.completed` as the main test for this app. The webhook handler retrieves the real Checkout Session from Stripe and expects `order_id` metadata created by `POST /api/checkout`, so a standalone synthetic trigger is not equivalent to a customer checkout.

## 6. Useful debugging

Stream Stripe API logs:

```bash
npm run stripe:logs
```

Run syntax checks:

```bash
npm test
```

## 7. Production notes

For production, create a Stripe webhook endpoint with:

```text
https://athletonic.com/api/stripe-webhook
```

Subscribe it to the same three events listed above, then set the production `STRIPE_WEBHOOK_SECRET` from that dashboard endpoint, not from local `stripe listen`.
