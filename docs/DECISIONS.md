# Decisions

Short notes on the choices behind Buzzwire, and why. Newest decisions go at the end of each
section.

## Platform

### PocketBase, self-hosted

The game needs auth, a database, realtime updates and a little trusted server logic. PocketBase
provides all four in a single binary: SQLite, auth collections, server-sent events, and JS hooks
for custom routes and cron. It runs comfortably on a home NAS, there's no separate database
server to manage, and backups are a built-in setting. Self-hosting keeps the running cost at zero
and is part of what the portfolio piece demonstrates.

### Frontend on Vercel, PocketBase on the NAS

The brief started with a single container serving both the app and the API. The deployment is
now split. The React app is a static build on Vercel (`buzzwire.danishali.dev`): a fast global
CDN, preview deploys, nothing to run. PocketBase stays on the NAS (`api.buzzwire.danishali.dev`).
PocketBase can't run on Vercel or another serverless host: it's a long-running process that keeps
SQLite on disk and holds realtime connections open.

- The frontend reads `VITE_PB_URL` at build time. Without it, the SDK talks to `/`: the Vite dev
  proxy locally, or PocketBase itself when it serves the app. The Docker image still bundles the
  built app in `pb_public`, so the one-container setup keeps working for local runs and the smoke
  test.
- Cross-origin requests use PocketBase's default CORS (any origin). Auth tokens travel in an
  `Authorization` header, not cookies, so another site can't make requests as a signed-in user.
- Vercel rewrites every path to `index.html` (`vercel.json`) for client-side routing.

PocketBase's own `index.html` fallback would also catch mistyped API URLs and answer them with a
200 HTML page, so `pb_hooks/api_not_found.pb.js` registers a `GET /api/{path...}` route that
returns a JSON 404. Real API routes are more specific and still win.

### CI builds the image

GitHub Actions checks every push and PR. On `main` it also builds the `linux/amd64` image and
pushes it to GHCR, so the NAS only ever runs `docker compose pull`. Nothing has to be built on the
NAS or on a laptop.

### No secrets in the frontend

The previous version of this project logged in as a PocketBase superuser from the browser, using
`VITE_*` environment variables. Vite inlines those into the public bundle, so anyone could read
the credentials. The rebuild removes this entirely. Hosts and players will authenticate as their
own scoped records (milestones 3 and 4), and anything that must be trusted runs in `pb_hooks`.

## Deployment

### Pinned, verified PocketBase release

The Dockerfile downloads a fixed PocketBase version and checks it against the release's
`checksums.txt` before unpacking. PocketBase is pre-1.0 and its hook API changes between minor
versions, so upgrades should be deliberate. `ARG PB_VERSION` in `docker/Dockerfile` is the single
source of truth; the Makefile reads it for the local dev binary.

### Hardened runtime image

The final stage is plain Alpine with the PocketBase binary, the hooks, the migrations and the
built app. It runs as an unprivileged `pocketbase` user. `--automigrate=false` stops PocketBase
from writing migration files when collections are edited in the production dashboard; schema
changes only arrive through `pb_migrations` in the repo. `--hooksWatch=false`, because hooks
never change inside a running container.

### Settings as a migration

App settings that every deployment needs live in `pb_migrations/1791800000_app_settings.js`
rather than as manual dashboard steps:

- trust the `X-Real-IP` header from Nginx Proxy Manager, so logs and the coming rate limits see
  real client IPs;
- nightly backups at 03:00 UTC, keeping 7.

### No time zone in the image

PocketBase's cron scheduler runs in UTC regardless of `TZ`, so the image doesn't install
`tzdata` and the compose file doesn't set `TZ`. Schedules are written in UTC.

## Tooling

### One package.json at the root

The React app lives in `web/` (the Vite root), but dependencies, scripts and tooling sit in a
single root `package.json`. Tests in `tests/` and config files share one install and one lockfile,
with no workspace setup.

### Dependency pinning

Dependencies are pinned to exact versions, choosing the newest release that was at least two
weeks old when it was added. That avoids picking up a compromised or broken release in its first
days. `npm ci` uses the lockfile as-is.

Regenerating the lockfile (`npm install` with no lockfile) currently needs npm 11+. npm 10, which
ships with Node 22, crashes while resolving Vitest's optional peer dependencies. `npm ci` from the
committed lockfile works on npm 10, which is what the Docker build uses.

### Dark theme only

The board is mostly shown on TVs and the buzzer on phones in dim rooms, so there's one
high-contrast dark theme instead of a light/dark toggle. shadcn's `dark:` variants always apply,
via `class="dark"` on `<html>`. The palette (ink and coral) is deliberately unlike any TV quiz
show's branding.
