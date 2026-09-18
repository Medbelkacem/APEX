# Free-tier production deploy (Vercel + Render + Atlas + Brevo + B2)

One public origin, **https://apex-dental-solution.com**, on entirely free
infrastructure. This is the currently-live deployment path. The
Docker/Caddy/Hostinger path in `docs/runbook.md` still works and is kept as
an alternative (e.g. if free-tier limits ever become a problem), but nothing
below depends on it.

## Architecture

```
Browser ──HTTPS──> apex-dental-solution.com (Vercel: Next.js web app)
                       │
                       │  same-origin fetch('/api/...')
                       ▼
              next.config.mjs rewrite (server-side, API_ORIGIN)
                       │
                       ▼
              https://apex-dm9i.onrender.com (Render: NestJS API, Docker)
                       │
          ┌────────────┼─────────────────┐
          ▼            ▼                 ▼
   MongoDB Atlas   Backblaze B2     Brevo SMTP
   (M0, replica    (S3-compatible   (transactional
    set)            object store)   email)
```

The browser only ever talks to one origin. `apps/web/src/lib/api/client.ts`
builds every request as a relative `/api/...` path; `next.config.mjs`'s
`rewrites()` (driven by the server-only `API_ORIGIN` env var) is what
actually forwards that, server-side, to Render. This is why
`NEXT_PUBLIC_API_URL` must **not** be set — setting it would make the browser
call Render directly, which is exactly the class of bug (a wrong/absent API
origin baked into the client bundle) that broke registration in the first
place.

No Redis anywhere: `QUEUE_DRIVER=inline` sends email in-process, and rate
limiting (`@nestjs/throttler`) and the `/api/health` check need no external
store. No Stripe: `STRIPE_MODE=test` with no real keys set boots the app fine
and the "Pay online" button reports itself as not configured instead of
erroring — nothing else about invoicing depends on it.

## 1. DNS

Add these wherever DNS for `apex-dental-solution.com` is actually managed —
check the domain's nameservers first (Hostinger's own, or
`dell.ns.cloudflare.com` / `jermaine.ns.cloudflare.com` if it's been moved to
Cloudflare). Only one of the two sections below applies.

### If DNS is on Hostinger (hPanel → Domains → DNS Zone)

| Type | Host | Value | Notes |
| --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | Vercel's apex IP — confirm against the exact value the Vercel dashboard shows after adding the domain |
| CNAME | `www` | `cname.vercel-dns.com` | |
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` | If another SPF record already exists (e.g. from a previous host), merge into one — two SPF TXT records is invalid, not additive |
| CNAME | *(from Brevo)* | *(from Brevo)* | DKIM — see §2, values are unique per Brevo account |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:postmaster@apex-dental-solution.com` | Start at `p=none` (monitor only); tighten to `quarantine`/`reject` once mail is confirmed flowing correctly |

### If DNS is on Cloudflare (nameservers `dell`/`jermaine.ns.cloudflare.com`)

Same records, same values, in Cloudflare's DNS tab — with one difference:
click the orange cloud icon to **grey it out ("DNS only")** for the `@` and
`www` records. Vercel issues and manages its own TLS certificate and needs to
see the real client connection; Cloudflare's proxy (orange cloud) would
terminate TLS itself and can break Vercel's domain verification and
certificate issuance. The TXT/CNAME records for SPF/DKIM/DMARC are never
proxied (Cloudflare only offers the toggle for proxyable record types like A
and CNAME to a web target) so there's nothing to change for those.

Render needs no DNS record at all — nothing ever calls `apex-dm9i.onrender.com`
directly except this app's own server-side proxy and you, for the health check.

## 2. Brevo sender verification (SPF, DKIM, DMARC)

1. Brevo dashboard → **Senders, Domains & Dedicated IPs → Domains** → add
   `apex-dental-solution.com` → **Authenticate this domain**.
2. Brevo shows a DKIM record as a **CNAME** with a host and value unique to
   your account (something like `mail._domainkey` / `brevo._domainkey` →
   `something.dkim.brevo.com`) — copy those two fields *exactly* as shown;
   they cannot be guessed or reused from another account.
3. Add the SPF TXT record from the table above (Brevo's page shows the same
   value; if a `MAIL_FROM_ADDRESS` other than `no-reply@apex-dental-solution.com`
   is ever used, it must be on this same authenticated domain).
4. Add the DMARC TXT record.
5. Back in Brevo, click **Verify** on the domain. DNS propagation can take
   anywhere from a few minutes to a few hours; re-check if it fails
   immediately after adding records.
6. Under **Senders**, add and verify `no-reply@apex-dental-solution.com` (or
   whatever `MAIL_FROM_ADDRESS` is set to) as a sender.

Registration and password-reset email will silently have nowhere to land
until this is done — the API itself boots and returns success either way
(the mail job just fails in its own queue/log).

## 3. Render (API)

The service already exists (`srv-damm0ke1egvs73cpe5o0`,
`https://apex-dm9i.onrender.com`, Docker runtime, `docker/api.Dockerfile`,
context = repo root, health check `/api/health`). `render.yaml` at the repo
root documents this as a Blueprint; the dashboard is the source of truth for
the existing service.

In the service's **Environment** tab, set every variable listed in
`apps/api/.env.production.example` — the shape and non-secret values are
there; the real secret values are not committed anywhere in this repo (see
the assistant's chat reply for the exact list to paste, generated once and
never written to a tracked file).

A few worth calling out:
- `TRUST_PROXY=true` — Render puts exactly one reverse proxy in front of the
  container; without this every client shares Render's own address for rate
  limiting and the audit trail.
- `COOKIE_SECURE=true` and `COOKIE_DOMAIN=apex-dental-solution.com` — the API
  itself never receives a request with `Host: apex-dental-solution.com`
  directly (Vercel's proxy is what the browser talks to), but the cookies it
  sets travel back through that same proxy under that host, so the `Domain`
  attribute needs to match what the browser actually sees, not the API's own
  Render hostname.
- `MONGODB_URI` — Atlas Network Access is `0.0.0.0/0` because Render's free
  tier has no static outbound IP to allowlist instead; the connection
  string's own username/password is the real access boundary here, so keep
  the Atlas database user's password strong and distinct from anything else.
- Cold starts: Render's free plan spins the service down after 15 minutes
  idle and takes up to roughly a minute to come back on the next request.
  That's expected, not a bug — see §6.

## 4. Vercel (web)

Project settings → **Environment Variables** (Production):

| Key | Value |
| --- | --- |
| `API_ORIGIN` | `https://apex-dm9i.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://apex-dental-solution.com` |

Do **not** add `NEXT_PUBLIC_API_URL` — see the architecture note above.

Domains tab: `apex-dental-solution.com` as the primary domain,
`www.apex-dental-solution.com` redirecting to it (already set up). A
Production deployment has to run *after* DNS in §1 resolves and after these
env vars are set — redeploy (Deployments → ⋯ → Redeploy) once both are true.

## 5. First super-admin

`pnpm db:seed` (`apps/api/src/database/seeders/run-seed.ts`) is idempotent
and creates exactly one super-admin from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`, plus the platform's real reference data (workflow
statuses, the lab's four case types) — no demo content. Run it once, from a
machine that can reach Atlas directly (Render has no "run a one-off shell
command" button on the free plan):

```bash
# From the repo root, with apps/api/.env.production.local filled in with the
# real Atlas URI and admin credentials (never commit that file):
cd apps/api
NODE_ENV=production \
MONGODB_URI="<the real mongodb+srv:// URI>" \
SEED_ADMIN_EMAIL="<the real admin email>" \
SEED_ADMIN_PASSWORD="<the real admin password>" \
pnpm --filter @dental/api seed
```

Re-running it later is safe — each seeder skips what already exists.

## 6. Post-deploy checklist

- [ ] `curl https://apex-dm9i.onrender.com/api/health` → `{"status":"ok",...}`
      (also reachable at `https://apex-dental-solution.com/api/health` once
      the proxy and DNS are both live)
- [ ] `https://apex-dental-solution.com/register` loads over HTTPS, no mixed
      content warnings
- [ ] Submitting the register form succeeds (allow up to ~60s on the very
      first request after a while — the "Server is waking up" message should
      appear, not an error)
- [ ] The verification email arrives (check spam while DMARC is still at
      `p=none`) and its link confirms the address
- [ ] An admin (seeded in §5) can approve the new dentist, and the dentist can
      then log in
- [ ] A case file uploads and downloads correctly (this proves the B2
      credentials, path-style addressing, and the Vercel→Render proxy all
      work for multipart bodies, not just JSON)
- [ ] Logout clears the session and a subsequent protected page redirects to
      `/login`

## Known limitation: very large file uploads through the proxy

Case files currently upload through the same path as everything else:
browser → Vercel rewrite → Render → validated (type, size, content) → B2.
This keeps the existing server-side file validation intact, which a
direct-to-B2 presigned-upload flow would have to weaken or drop (a presigned
PUT lets the browser send bytes straight to B2, past the point where the API
can inspect them before they're stored).

Untested against the real proxy: whether Vercel's external-rewrite routing
enforces the same body-size ceiling as an actual Next.js Serverless Function
(commonly documented as 4.5 MB) or a larger, proxy-specific one — the two are
different code paths on Vercel's side, and there's no way to confirm which
applies without a real deployment to throw a large file at. If a case file
upload fails specifically at some size well under `MAX_UPLOAD_MB` (default
100 MB), that's the ceiling being hit, and the fix is a presigned-URL upload
flow (browser gets a signed PUT URL from the API, uploads directly to B2,
then tells the API to record it) — a real feature addition, not a
config change, so it's deliberately not implemented speculatively here.

## Rollback

Vercel: Deployments → pick the previous one → **Promote to Production**.
Render: Deploys tab → pick the previous successful deploy → **Redeploy**.
Neither needs a database change — schema changes here are additive Mongoose
schema edits, not migrations.
