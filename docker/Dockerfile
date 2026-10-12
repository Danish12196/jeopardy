# syntax=docker/dockerfile:1

# Buzzwire runs as a single container: PocketBase serves the API, the realtime
# stream, the JS hooks and the built React app (from pb_public).

# Pinned PocketBase release. The Makefile reads this line, so it's the only
# place to bump the version.
ARG PB_VERSION=0.40.5
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.22

# --- Build the React app ------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Download and verify the PocketBase binary --------------------------------
FROM alpine:${ALPINE_VERSION} AS pocketbase
ARG PB_VERSION
ARG TARGETARCH
WORKDIR /tmp/pb
RUN set -eu; \
    base="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}"; \
    zip="pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip"; \
    wget -q "${base}/${zip}" "${base}/checksums.txt"; \
    grep " ${zip}\$" checksums.txt | sha256sum -c -; \
    unzip -q "${zip}" pocketbase -d /pb

# --- Runtime ------------------------------------------------------------------
FROM alpine:${ALPINE_VERSION}
RUN addgroup -S pocketbase && adduser -S -G pocketbase -h /pb pocketbase
WORKDIR /pb
COPY --from=pocketbase /pb/pocketbase ./pocketbase
COPY pb_migrations ./pb_migrations
COPY pb_hooks ./pb_hooks
COPY --from=web /app/dist ./pb_public
RUN mkdir pb_data && chown pocketbase:pocketbase pb_data

USER pocketbase
VOLUME /pb/pb_data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1:8090/api/health || exit 1

# Schema changes come from pb_migrations in the repo, so automigrate (which
# writes migration files when collections are edited in the dashboard) is off.
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", \
     "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations", \
     "--hooksWatch=false", "--automigrate=false"]
