# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS build
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
# metadataBase. A production image has to be built with the real origins:
#   docker build -f docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://example.com \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://example.com .
# The defaults repeat the in-code localhost fallbacks so an un-argumented
# build still produces a working local image.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @dental/shared-types build && pnpm --filter @dental/web build

# ── Runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
