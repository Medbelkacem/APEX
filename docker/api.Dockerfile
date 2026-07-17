# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm --filter @dental/shared-types build && pnpm --filter @dental/api build

# ── Runtime stage ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
