# syntax=docker/dockerfile:1.7
#
# Shiftnest container image.
#
#   docker build -t shiftnest .
#   docker run -p 3000:3000 -v shiftnest-data:/data -e ORIGIN=http://localhost:3000 shiftnest
#
# The app is plain JavaScript plus better-sqlite3, which ships prebuilt binaries
# for every platform. So everything is built once on the build machine and the
# result runs unchanged on amd64 and arm64 (Raspberry Pi) images.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# Build metadata shown in the app and returned by /api/health.
ARG BUILD_NUMBER=0
ARG GIT_SHA=unknown
ARG BUILD_DATE
ENV BUILD_NUMBER=${BUILD_NUMBER} GIT_SHA=${GIT_SHA} BUILD_DATE=${BUILD_DATE}

RUN npx svelte-kit sync \
	&& npm run build \
	&& npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
	&& mkdir -p /data

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

ARG VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_DATE
LABEL org.opencontainers.image.title="Shiftnest" \
	org.opencontainers.image.description="Clean, ad-free, self-hostable volunteer shift scheduler" \
	org.opencontainers.image.source="https://github.com/lobojoel2003/Shiftnest" \
	org.opencontainers.image.licenses="MIT" \
	org.opencontainers.image.version="${VERSION}" \
	org.opencontainers.image.revision="${GIT_SHA}" \
	org.opencontainers.image.created="${BUILD_DATE}"

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_PATH=/data/shiftnest.db

WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/server.js ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /data /data

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
