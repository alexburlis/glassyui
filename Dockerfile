# The distro trust store removes the compromised eMudhra certificate paths.
FROM node:22.23.2-alpine3.23 AS trusted-os
RUN apk add --no-cache --upgrade ca-certificates ca-certificates-bundle 'libssl3>=3.5.9-r0' 'libcrypto3>=3.5.9-r0' 'zlib>=1.3.2-r1' \
    && update-ca-certificates

# Node-owned musl/source recipe: nodejs/docker-node@84410eeaede25daf49826da8265fbf548cc604fe.
FROM trusted-os AS node-security
ARG TARGETARCH
RUN apk add --no-cache --virtual .node-security-tools curl tar xz \
    && mkdir -p /tmp/node-release/bin \
    && case "${TARGETARCH}:$(apk --print-arch)" in \
      amd64:x86_64) \
        curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 120 \
          --output /tmp/node.tar.xz https://nodejs.org/dist/v22.23.4/node-v22.23.4-linux-x64-musl.tar.xz \
        && echo '38355b952f0392b91703d38a0d9af84eb0ff77d69828ca4bc8cc3bc3af80a720  /tmp/node.tar.xz' | sha256sum -c - \
        && tar -xJf /tmp/node.tar.xz -C /tmp/node-release --strip-components=1 \
          node-v22.23.4-linux-x64-musl/bin/node \
        ;; \
      arm64:aarch64) \
        apk add --no-cache --virtual .node-security-build binutils-gold g++ gcc libgcc linux-headers make python3 py-setuptools \
        && curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 120 \
          --output /tmp/node-source.tar.xz https://nodejs.org/dist/v22.23.4/node-v22.23.4.tar.xz \
        && echo '7b9adc82d612d0a2a863d96c46de2292552e250cee51956ebbe0146c42aacae9  /tmp/node-source.tar.xz' | sha256sum -c - \
        && tar -xJf /tmp/node-source.tar.xz -C /tmp \
        && cd /tmp/node-v22.23.4 && ./configure \
        && timeout 3600 make -j2 \
        && make install DESTDIR=/tmp/node-security-install \
        && cp /tmp/node-security-install/usr/local/bin/node /tmp/node-release/bin/node \
        ;; \
      *) echo 'Unsupported or inconsistent Node security target architecture' >&2; exit 1 ;; \
    esac \
    && test "$(/tmp/node-release/bin/node --version)" = v22.23.4

FROM trusted-os AS trusted-base
COPY --from=node-security /tmp/node-release/bin/node /usr/local/bin/node
ENV NODE_VERSION=22.23.4

# ── Stage 1: Build ──────────────────────────────────────────────
FROM trusted-base AS builder
ARG SOURCE_COMMIT
ARG NEXT_PUBLIC_SENTRY_DSN
WORKDIR /app
RUN corepack enable

# 1. Package manifests and dependency patches (cached until either changes)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY vendor ./vendor
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--use-openssl-ca" pnpm install --frozen-lockfile

# 2. Source (filtered by .dockerignore), then the static build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=SOURCE_COMMIT,env=BUILD_SOURCE_COMMIT \
    --mount=type=secret,id=NEXT_PUBLIC_SENTRY_DSN,env=BUILD_SENTRY_DSN \
    SOURCE_COMMIT="${BUILD_SOURCE_COMMIT:-$SOURCE_COMMIT}" \
    NEXT_PUBLIC_SENTRY_DSN="${BUILD_SENTRY_DSN:-$NEXT_PUBLIC_SENTRY_DSN}" \
    NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--use-openssl-ca" pnpm build

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM trusted-base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1

# Standalone output carries only the traced dependencies.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "--use-openssl-ca", "server.js"]
