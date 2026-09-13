# Operations Runbook

Operational procedures for the Apex Digital Lab platform.

## Local development

```bash
pnpm install
cp .env.example .env
docker compose up -d mongo redis mailpit   # requires docker access
pnpm db:seed
pnpm dev
```

- API: http://localhost:4000 · OpenAPI: http://localhost:4000/docs
- Web: http://localhost:3000
- Mailpit (captured emails): http://localhost:8025

The seed creates a super-admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(defaults: `admin@apex.example` / `ChangeMe123!`).

## Database schema & indexes

MongoDB is schemaless, so there are no migration files. Collection shapes are
defined by the Mongoose schemas in `apps/api/src/database/entities`, and their
indexes (unique email, case reference, invoice number, the composite statement
key, …) are built automatically on boot (`autoIndex: true`). After changing an
index in a schema, restart the API to rebuild it; a running instance can be
resynced without downtime with `Model.syncIndexes()`.

MongoDB requires a **replica set** for the app's transactions (case + status
history, invoice + line items, reference numbering). Provision the production
database as a replica set — even a single node — or those writes will fail.

Reference data (workflow statuses, case types, first super-admin) is seeded,
idempotently, with `pnpm db:seed`.

## Deploy

1. CI runs lint → typecheck → test → build on every PR.
2. On merge to `main`, build and push the `docker/api.Dockerfile` and
   `docker/web.Dockerfile` images.
3. Run `pnpm db:seed` against the target database on first release (and whenever
   new reference data is added); it is idempotent.
4. Roll back by redeploying the previous image tag. Document changes are
   backward-compatible by default, so a rollback needs no schema step.

## Backups & restore

- **Database:** daily `mongodump`; verify monthly with a `mongorestore` drill.
- **Storage volume** (`storage/`): daily snapshot of case files, invoices, and
  statements. Metadata lives in the DB, so restore both together.

## Production checklist

The API refuses to start with `NODE_ENV=production` unless:

- `JWT_SECRET` is at least 32 characters and not one of the template values
  (`openssl rand -base64 48` produces a suitable one);
- `COOKIE_SECURE=true`, so the session cookies are only ever sent over TLS.

And it should also have:

- `TRUST_PROXY` set to the number of reverse proxies in front of it (usually
  `1`), or their addresses. Without it every client shares the proxy's address
  for rate limiting and the audit trail; with it set too generously a caller can
  spoof their address through `X-Forwarded-For`.
- `API_DOCS_ENABLED` left at `false` unless the Swagger UI is deliberately
  wanted; it maps every route for whoever can reach it.
- `CORS_ORIGINS` and `COOKIE_DOMAIN` set to the real web origin and domain.
- `NEXT_PUBLIC_API_URL` set at **build** time of the web app: it is baked into
  the Content-Security-Policy's `connect-src`, so a web build pointed at the
  wrong API origin cannot talk to the right one.

The web app sends a Content-Security-Policy, `X-Frame-Options: DENY`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and (in
production) HSTS on every response — see `apps/web/security-headers.mjs`. Any
new third-party resource (a script, a font host, an iframe) has to be added
there or the browser will block it.

## Rotate secrets

Secrets (`JWT_SECRET`, Stripe keys, SMTP credentials) live in environment
config, never in the repo. Platform-level secrets are stored encrypted in
`platform_settings`. To rotate: update the environment/secret store and redeploy;
rotating `JWT_SECRET` invalidates all active sessions.

## Health & monitoring

- Liveness/readiness: `GET /api/health` (checks the database).
- Structured JSON logs carry an `x-request-id` per request.
- Alert on: elevated error rate, failed background jobs (dead-letter queue),
  expiring SSL certificates, and low disk space on the storage volume.

## Stripe

Keys are read from Platform Settings first, falling back to environment config,
so a super admin can rotate them without a redeploy (Settings → `stripe.*`).

Until real keys are in place the platform treats Stripe as **not configured**:
the `sk_test_xxx` / `whsec_xxx` fillers in `.env.example` (and the config
layer's own `*_placeholder` fallbacks) are recognised as such, and the Pay
button reports it plainly instead of sending a filler to Stripe. Nothing else
about invoicing depends on Stripe — issuing, PDFs, statements and the admin
"mark paid" path for offline payments all work without it.

### Enabling online payment

1. In the Stripe Dashboard (Developers → API keys) take the **secret key**
   (`sk_test_…` while testing, `sk_live_…` for real money) and the matching
   **publishable key** (`pk_…`).
2. Developers → Webhooks → add an endpoint at
   `https://<api host>/api/payments/webhook` subscribing to
   `payment_intent.succeeded`, `payment_intent.payment_failed` and
   `charge.refunded`. Copy its **signing secret** (`whsec_…`).
3. Enter all three as a super admin under Platform Settings (`stripe.secret_key`,
   `stripe.publishable_key`, `stripe.webhook_secret`), or set
   `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` in the
   environment. Set `stripe.mode` / `STRIPE_MODE` to match the key; a mismatch
   is logged as a warning at every payment.
4. The web app reads the publishable key from the payment-intent response, so
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` needs no change.

Locally, the Stripe CLI stands in for the dashboard endpoint and prints the
signing secret to use:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

### How a payment settles

1. A dentist opens an **issued** invoice and clicks *Pay this invoice online*.
   The API creates a Payment Intent for the invoice total (in minor units,
   idempotently per invoice) and returns its client secret.
2. Stripe's card form runs in Stripe's own iframe; card details never touch the
   platform. The browser confirms the payment with Stripe directly.
3. Stripe calls the webhook. The signature is verified against the **raw**
   request body — never add a body-parsing middleware in front of that route —
   and the invoice is marked paid only if `amount_received` and the currency
   match the invoice. The dentist is notified by email.
4. The browser's own "succeeded" only refreshes the page; the webhook is the
   source of truth. Redelivered events are tolerated, a success arriving after a
   refund is ignored, and a success for an invoice that is already paid by
   another intent (or offline) is recorded as `payment.duplicate_detected` in
   the audit log — that is money to refund at Stripe.

If a dentist reloads between the charge and the webhook, the Pay button asks
Stripe for the stored intent first: one that has succeeded is applied on the
spot and a second charge refused; one still processing is refused too.

## Monthly statements

A scheduled job runs at 00:00 on the 1st of each month and generates statements
for the month that just closed, for every active dentist. It is safe to re-run:
statements are keyed on dentist + period and are updated in place, so a late
invoice can be reflected by regenerating from the admin Statements page.

## Background jobs

Email (and later PDF/statement) jobs run on BullMQ/Redis with exponential-backoff
retries; exhausted jobs remain on the failed set as a dead-letter store for
inspection. Inspect via a BullMQ dashboard or Redis directly.
