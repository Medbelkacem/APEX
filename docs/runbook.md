# Operations Runbook

Operational procedures for the Dental Laboratory Management Platform.

## Local development

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis mailpit   # requires docker access
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API: http://localhost:4000 · OpenAPI: http://localhost:4000/docs
- Web: http://localhost:3000
- Mailpit (captured emails): http://localhost:8025

The seed creates a super-admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(defaults: `admin@dental-lab.test` / `ChangeMe123!`).

## Database migrations

Schema changes are always made through versioned, reversible migrations —
`synchronize` is disabled everywhere.

```bash
# After editing entities, generate a migration from the diff:
pnpm --filter @dental/api migration:generate src/database/migrations/<Name>

# Apply / roll back:
pnpm db:migrate
pnpm --filter @dental/api migration:revert
```

## Deploy

1. CI runs lint → typecheck → test → build on every PR.
2. On merge to `main`, build and push the `docker/api.Dockerfile` and
   `docker/web.Dockerfile` images.
3. Run `pnpm db:migrate` against the target database before releasing the API.
4. Roll back by redeploying the previous image tag; revert the last migration if
   the release included a schema change.

## Backups & restore

- **Database:** daily `pg_dump`; verify monthly with a restore drill.
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

## Background jobs

Email (and later PDF/statement) jobs run on BullMQ/Redis with exponential-backoff
retries; exhausted jobs remain on the failed set as a dead-letter store for
inspection. Inspect via a BullMQ dashboard or Redis directly.
