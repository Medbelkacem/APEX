# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile=false
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Both of these are consumed while `next build` runs, not when the server
# starts, so they cannot be supplied through the runtime environment:
# NEXT_PUBLIC_API_URL is inlined into the client bundle and baked into the
# Content-Security-Policy's connect-src (next.config.mjs -> routes-manifest),
# and NEXT_PUBLIC_SITE_URL is baked into robots.txt, the sitemap and
# metadataBase. A production image should be built with the real origins:
#   docker build -f docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://example.com \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://example.com .
# (`docker/compose.prod.yml` already passes both.) NEXT_PUBLIC_API_URL
# defaults to empty rather than a localhost URL: an un-argumented build then
# falls through to `lib/api/client.ts`'s own same-origin default, which a
# single-origin reverse proxy (Caddy, here) serves correctly — instead of
# silently baking a loopback address into the client bundle, which is unusable
# from any real browser and was the cause of a past production outage.
# NEXT_PUBLIC_SITE_URL has no such relative fallback (it builds absolute URLs
# for metadata/sitemap/robots), so it keeps a working localhost default; the
# local full-stack profile in the root docker-compose.yml passes both
# explicitly since web and api are not behind a shared origin there.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @dental/shared-types build && pnpm --filter @dental/web build

# ── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
