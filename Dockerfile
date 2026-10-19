# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22.22.2-alpine3.22 AS builder
ARG SOURCE_COMMIT
ARG NEXT_PUBLIC_SENTRY_DSN
WORKDIR /app
RUN corepack enable

# 1. Package manifests and dependency patches (cached until either changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY vendor ./vendor
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Source (filtered by .dockerignore), then the static build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=SOURCE_COMMIT,env=BUILD_SOURCE_COMMIT \
    --mount=type=secret,id=NEXT_PUBLIC_SENTRY_DSN,env=BUILD_SENTRY_DSN \
    SOURCE_COMMIT="${BUILD_SOURCE_COMMIT:-$SOURCE_COMMIT}" \
    NEXT_PUBLIC_SENTRY_DSN="${BUILD_SENTRY_DSN:-$NEXT_PUBLIC_SENTRY_DSN}" \
    pnpm build

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:22.22.2-alpine3.22 AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1

# Standalone output carries only the traced dependencies.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
