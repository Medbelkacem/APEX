# Dental Laboratory Management Platform

A production-grade web platform that digitizes the operations of a dental laboratory —
covering a public **marketing website**, an authenticated **dentist portal**, and an
**admin dashboard**, all sharing a single backend with role-based access control.

Built to the _Developer Requirements Specification (DRS v1.0)_.

## Architecture

Modular monolith in a pnpm + Turborepo monorepo.

| Package | Stack | Purpose |
| --- | --- | --- |
| `apps/api` | NestJS · TypeScript · TypeORM · PostgreSQL | REST API, RBAC, integrations, background jobs |
| `apps/web` | Next.js (App Router) · React · TypeScript · Tailwind | Marketing site + dentist portal + admin dashboard |
| `packages/shared-types` | TypeScript | Types shared between web and api |
| `packages/ui-kit` | React | Reusable UI components |
| `packages/eslint-config` | — | Shared lint config |

**Integrations:** Stripe (Payment Intents + webhooks), SMTP/SendGrid email, server-side
PDF generation, local→S3 storage abstraction, Redis/BullMQ background jobs.

## Roles

`super_admin` · `admin` · `dentist` · public visitor — a single `User` entity plus a
`role` enum, enforced at the route, controller, and UI levels.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Docker is **optional** (only for the production-like stack; see below)

## Quick start (no Docker, no Redis)

The fastest way to run everything — a userspace PostgreSQL is started for you, the
schema is migrated + seeded, and the API + web run in watch mode. Emails print to
the API logs and the job queue runs in-process (`QUEUE_DRIVER=inline`).

```bash
pnpm install
cp .env.example .env      # the committed defaults already work for local dev
pnpm start:local
```

- Web → http://localhost:3000
- API → http://localhost:4000 (OpenAPI docs at `/docs`)
- Default login → `admin@dental-lab.test` / `ChangeMe123!`

Prefer to manage the database yourself? `pnpm db:local` runs just the userspace
Postgres (migrated + seeded); then `pnpm dev` runs the apps in another terminal.

## Full stack with Docker (Postgres + Redis + Mailpit)

For a production-like setup with the real BullMQ/Redis queue and a mail catcher:

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Set `QUEUE_DRIVER=redis` and `MAIL_DRIVER=smtp` in `.env` for this mode.
Mailpit (captured emails) → http://localhost:8025.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run api + web in watch mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all unit tests (api + web) |
| `pnpm db:migrate` | Run TypeORM migrations |
| `pnpm db:seed` | Seed reference + admin data |

## Testing

| Layer | Command | Notes |
| --- | --- | --- |
| API unit | `pnpm --filter @dental/api test` | Jest, no infrastructure needed |
| Web unit | `pnpm --filter @dental/web test` | Vitest + Testing Library (jsdom) |
| API end-to-end | `pnpm --filter @dental/api test:e2e` | Needs a running PostgreSQL |

The end-to-end suite boots the real Nest application — global guards, cookie
session, serializer, Stripe raw-body webhook — against a real database. It
creates and migrates its own **`dental_test`** database and truncates between
tests, so it never touches your development data. Start a database first with
`pnpm db:local` (or `pnpm docker:up`); the suite fails with instructions if it
cannot reach one. Redis is not required: jobs run inline and mail goes to the
logger.

A real PostgreSQL is deliberate rather than incidental — case and invoice
numbering take a transaction-scoped advisory lock, filtering uses `INTERVAL`
and `ILIKE`, and money lives in `decimal` columns whose string round-tripping
is part of what the suite asserts. An in-memory engine would test a different
program.

The five money-path defects that suite originally caught — a double Stripe
refund, a redelivered webhook un-refunding an invoice, settlement that never
checked the amount collected, a statement restated by downloading it, and a
refund overstating the closing balance — are fixed. Their reproductions now
live as ordinary regression guards in `payments.e2e-spec.ts` and
`statements.e2e-spec.ts`.

## Repository layout

```
apps/
  api/    NestJS backend (modules/ common/ config/ database/ jobs/)
  web/    Next.js frontend (app route groups: public, auth, dentist, admin)
packages/ shared-types, ui-kit, eslint-config
storage/  local file volume (gitignored): cases/ invoices/ statements/
docker/   Dockerfiles
docs/     ERD + operational docs
```

## Feature map

| Area | Endpoints | UI |
| --- | --- | --- |
| Auth & accounts | `/auth/*`, `/users/*` | login, forgot/reset, first-login setup, profile |
| Marketing site | `/contact`, `/catalog/case-types` (public) | home, about, services, contact, how-to-send-a-case |
| Cases | `/cases/*` incl. multipart upload + streamed download | submission wizard, list + filters, detail with timeline |
| Workflow & catalog | `/catalog/case-statuses/*` | admin workflow editor with reordering |
| Pricing | `/pricing/*`, `/pricing/quote` | admin pricing rules + quote preview |
| Invoicing | `/invoices/*`, Stripe `/payments/webhook` | dentist pay-online, admin issue/mark-paid/refund |
| Statements | `/statements/*` | monthly list + PDF, admin generate/send |
| Notifications | `/notifications/*`, `/admin/notifications/*` | bell feed, admin broadcast + delivery log |
| Reporting | `/statistics/*` incl. CSV export | admin dashboard charts + reports |
| Platform | `/settings`, `/audit-logs` | super-admin settings and audit trail |

**File uploads** are validated server-side by magic-byte sniffing (not the
browser's `Content-Type`): `.stl` (binary + ASCII), `.png`, `.jpg/.jpeg`, `.pdf`,
each with its own size cap. Downloads stream through an authenticated endpoint
that verifies case ownership.

## Sessions

A session is a short-lived access JWT (`JWT_ACCESS_TTL`, 15 min) in an HttpOnly
cookie, plus a refresh token stored server-side in `refresh_tokens`. Only the
token's SHA-256 is persisted, so a database backup cannot resume anyone's
session.

Refresh tokens are single-use. Each refresh spends the presented token and
issues a successor in the same family, so a token used twice means two parties
held it — and since neither can be identified as the legitimate one, the family
is revoked. A replay within `REFRESH_REUSE_LEEWAY` is treated as a race instead
(two tabs waking together), provided the family still has a live token. Sessions
also end on idle (`SESSION_IDLE_TTL`), at an absolute ceiling
(`JWT_REFRESH_TTL`, which rotation never extends), at logout, on a password
change or reset, and when an account is disabled.

Because the access token is short, both clients renew: the browser client
retries a 401 once behind a refresh, coalescing concurrent refreshes into one
request, and Next.js middleware refreshes on navigation — a server component
cannot set cookies, so middleware is the only place an SSR session can be
renewed.

**Passwords** are Argon2id at the OWASP baseline (`ARGON2_*`). Accounts created
before the migration still hold bcrypt hashes; those verify normally and are
re-hashed on the next successful login, which is the only moment the plaintext
exists.

**CSRF** is enforced on every state-changing request in two layers: a stated
`Origin`/`Referer` must be one we serve, and a caller holding the (script-
readable) `csrf_token` cookie must echo it in `X-CSRF-Token`. Clients that state
no origin and hold no cookie — curl, mobile, server-to-server — are not subject
to CSRF and are not blocked. The signature-verified Stripe webhook is exempt.

**Money** crosses the wire as decimal strings and is computed in integer cents,
so totals never drift through binary floating point.

## Branding

The brand mark lives in `docs/brand/logo-source.jpg`. Derived assets
(`apps/web/public/logo.png`, `logo-white.png`, `apps/web/src/app/icon.png`,
`apps/api/assets/logo.png`) are transparent PNGs generated from it. In the web UI
the mark is applied as a CSS mask over `currentColor`, so one asset adapts to
every surface; emails and PDFs embed the PNG directly.

Workflow-status colours are a **validated categorical palette** — every adjacent
pair clears the colour-blind and normal-vision separation floors on a light
surface. Re-validate before changing them; statuses always render with their
label so identity never rests on colour alone.

## Development milestones

The build follows the DRS milestone plan:

1. **Week 1 — Foundation:** scaffolding, auth, RBAC, marketing site. _(done)_
2. **Week 2 — Dentist portal:** case submission, file upload, tracking, dashboard. _(done)_
3. **Week 3 — Admin dashboard & workflow:** dentist/case/pricing/workflow management, stats. _(done)_
4. **Week 4 — Invoicing, statements, integrations & hardening.** _(done)_
5. **Week 5 (optional) — Polish, performance, launch.**

See `docs/` and the deliverables checklist in the DRS.
