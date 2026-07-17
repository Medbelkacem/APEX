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
| `pnpm test` | Run all tests |
| `pnpm db:migrate` | Run TypeORM migrations |
| `pnpm db:seed` | Seed reference + admin data |

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

## Development milestones

The build follows the DRS milestone plan:

1. **Week 1 — Foundation:** scaffolding, auth, RBAC, marketing site. _(current)_
2. **Week 2 — Dentist portal:** case submission, file upload, tracking, dashboard.
3. **Week 3 — Admin dashboard & workflow:** dentist/case/pricing/workflow management, stats.
4. **Week 4 — Invoicing, statements, integrations & hardening.**
5. **Week 5 (optional) — Polish, performance, launch.**

See `docs/` and the deliverables checklist in the DRS.
