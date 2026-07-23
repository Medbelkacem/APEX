# Operations Runbook

Operational procedures for the Dental Laboratory Management Platform.

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
(defaults: `admin@dental-lab.test` / `ChangeMe123!`).

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

Point a Stripe webhook endpoint at `POST /api/payments/webhook` subscribing to
`payment_intent.succeeded`, `payment_intent.payment_failed`, and
`charge.refunded`. The route is unauthenticated by necessity and is instead
verified by the payload signature against the **raw** request body — never add a
body-parsing middleware in front of it. Locally:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

The webhook is the source of truth for settlement; the browser confirming a
payment only updates the UI. `markPaid` is idempotent, so redelivered events are
safe.

## Monthly statements

A scheduled job runs at 00:00 on the 1st of each month and generates statements
for the month that just closed, for every active dentist. It is safe to re-run:
statements are keyed on dentist + period and are updated in place, so a late
invoice can be reflected by regenerating from the admin Statements page.

## Background jobs

Email (and later PDF/statement) jobs run on BullMQ/Redis with exponential-backoff
retries; exhausted jobs remain on the failed set as a dead-letter store for
inspection. Inspect via a BullMQ dashboard or Redis directly.
