# Deploying Buzzwire

| Service    | Runs on                          | Address                          |
| ---------- | -------------------------------- | -------------------------------- |
| Frontend   | Hostinger web hosting            | `https://jeopardy.danishali.dev` |
| PocketBase | Synology NAS (Docker) + Nginx PM | `https://pb-db.danishali.dev`    |

- **DNS** for `danishali.dev` is at Hostinger (nameservers `ns1/ns2.dns-parking.com`).
- **Repo:** https://github.com/Danish12196/jeopardy (public).

## What's automatic once it's set up

Every push to `main` runs CI (`.github/workflows/ci.yml`). Once the checks pass:

- **Frontend:** CI builds the app with `VITE_PB_URL=https://pb-db.danishali.dev` and force-pushes
  the built files to the **`frontend-dist`** branch: `index.html`, `assets/`, `favicon.svg` and
  `.htaccess` at the branch root. Hostinger's Git deployment pulls that branch into the
  `jeopardy.danishali.dev` folder.
- **Backend:** CI builds the PocketBase image and pushes it to
  **`ghcr.io/danish12196/buzzwire`** (`:latest` and `:<commit sha>`). The NAS pulls it.

Nothing is built on Hostinger or on the NAS.

## Order of steps

Each step depends on the one before it:

| #   | Who / where         | What                                                                  | Produces                  |
| --- | ------------------- | --------------------------------------------------------------------- | ------------------------- |
| 1   | GitHub              | Merge the rebuild to `main`; CI publishes `frontend-dist` + the image | branch + image            |
| 2   | GitHub              | Make the image public                                                 |                           |
| 3   | NAS agent (part A)  | Run PocketBase, find the home address                                 | `HOME_ADDRESS`, `PB_PORT` |
| 4   | **Hostinger agent** | Subdomain, Git deployment, SSL, DNS for both domains                  | site live, webhook URL    |
| 5   | GitHub              | Add the Hostinger webhook so frontend deploys are automatic           |                           |
| 6   | NAS agent (part B)  | Nginx Proxy Manager host + HTTPS certificate for `pb-db`              | API live                  |
| 7   | Anyone              | Final checks                                                          |                           |

---

## Step 1: merge to `main` (GitHub)

Merge the branch with the rebuild into `main`, then wait for the **CI** workflow on `main` to go
green (GitHub → Actions). Check that:

- the branch **`frontend-dist`** exists and has `index.html` and `.htaccess` at its root;
- the package **`buzzwire`** appears under the repo owner's GitHub profile → Packages.

## Step 2: make the image public (GitHub)

GitHub profile → **Packages** → **buzzwire** → **Package settings** → **Danger zone → Change
visibility** → **Public**. This lets the NAS pull it without a login. (Alternatively, give the
NAS agent a GitHub token with `read:packages` and have it run `docker login ghcr.io`.)

---

## Step 3: NAS agent, part A (run PocketBase)

> Paste into an agent with SSH access to the Synology NAS (and ideally the DSM and Nginx Proxy
> Manager web UIs).

```text
Set up the Buzzwire PocketBase server on my Synology DS923+ (x86_64) with Docker (Container
Manager), behind my existing Nginx Proxy Manager (NPM). Repo:
https://github.com/Danish12196/jeopardy (see docker-compose.yml and docs/DEPLOY.md).

1. Create /volume1/docker/buzzwire. Put the repo's docker-compose.yml there, plus a .env with:
     BUZZWIRE_IMAGE=ghcr.io/danish12196/buzzwire
     BUZZWIRE_TAG=latest
     BUZZWIRE_PORT=8090
   If 8090 is taken on the NAS, pick a free port (PB_PORT) and tell me which.
   Start it with `docker compose pull && docker compose up -d` in that folder, or as a Container
   Manager Project pointed at that folder. If the pull is denied, the GHCR package is still
   private: stop and tell me.
2. Wait until `docker inspect -f '{{.State.Health.Status}}' buzzwire` says "healthy". Check that
   `curl -s http://127.0.0.1:<PB_PORT>/api/buzzwire/hello` returns {"message":"Hello from Buzzwire",...}.
3. Create the PocketBase superuser with my email and a strong random password. Show me the
   password once and don't store it anywhere else:
     docker compose exec buzzwire /pb/pocketbase superuser upsert <my email> '<password>' --dir /pb/pb_data
4. Find out how the internet reaches this NAS. Don't change anything yet:
   - Is NPM running, and on which ports?
   - Are TCP 80 and 443 on the router forwarded to NPM? (Existing NPM hosts that already work
     from outside, e.g. Jellyfin, are a good sign.)
   - What's the public address? Prefer a DDNS hostname (DSM → External Access → DDNS, e.g.
     xxx.synology.me); otherwise the public IPv4. Is the connection behind CGNAT?
5. Optional, recommended: in DSM → Control Panel → Task Scheduler, add a daily root task that
   keeps the server updated:
     cd /volume1/docker/buzzwire && docker compose pull -q && docker compose up -d && docker image prune -f
6. STOP and report: PB_PORT, the NAS LAN IP, HOME_ADDRESS (DDNS hostname or IPv4), and whether
   80/443 reach NPM from the internet. If they don't, explain the options instead of continuing.
```

---

## Step 4: Hostinger agent (frontend + DNS)

> Paste into an agent with access to the Hostinger account (hPanel, or the Hostinger API).
> Replace `<HOME_ADDRESS>` with the value from step 3. Menu names in hPanel may differ slightly
> from those below.

```text
Deploy the Buzzwire frontend on my Hostinger web hosting at jeopardy.danishali.dev, and add DNS
for the backend at pb-db.danishali.dev. Never delete or overwrite existing DNS records or sites;
if something conflicts, stop and ask me.

Facts:
- Domain: danishali.dev. Its DNS is managed in this Hostinger account (ns1/ns2.dns-parking.com).
- The frontend is pre-built static files on the `frontend-dist` branch of the public repo
  https://github.com/Danish12196/jeopardy.git (index.html, assets/, favicon.svg, .htaccess at the
  branch root). No build step and no Node.js on Hostinger.
- .htaccess (LiteSpeed/Apache) already handles client-side routing (unknown paths → index.html)
  and cache headers. It must end up in the subdomain's document root.
- The backend runs on my home NAS, not on Hostinger. Its address is HOME_ADDRESS = <HOME_ADDRESS>.

A. Check what I have
   1. List my hosting plans and websites. I need a web hosting plan (Single/Premium/Business or
      Cloud) that supports subdomains, Git deployment and free SSL. If I only own the domain and
      have no hosting plan, STOP and tell me (with the cheapest suitable plan). Don't buy anything
      without my OK.
   2. Is danishali.dev itself set up as a website in hPanel? Note its document root
      (usually public_html, or domains/danishali.dev/public_html).
   3. Check the DNS zone for existing records named "jeopardy", "pb-db" or a wildcard "*". Report
      any you find; don't change them.

B. Create the subdomain jeopardy.danishali.dev
   - If danishali.dev is a website: Websites → danishali.dev → Domains → Subdomains → create
     "jeopardy". Use a dedicated, empty folder (e.g. public_html/jeopardy) and note its full path.
   - If danishali.dev is not a website in this account: add jeopardy.danishali.dev as its own
     website (Add website → use an existing domain/subdomain), empty, no WordPress or builder.
   - Make sure the subdomain's DNS points at this hosting. Creating it in hPanel normally adds an
     A record "jeopardy" automatically: verify it exists.

C. Deploy from Git
   1. Websites → (the site owning the subdomain) → Advanced → GIT → create a repository:
        Repository: https://github.com/Danish12196/jeopardy.git
        Branch:     frontend-dist
        Install path / directory: the subdomain's folder from step B (relative to public_html,
                    e.g. "jeopardy"). Hostinger requires this folder to be empty: if the subdomain
                    created a default index.php or default.php there, delete that file first.
   2. Click Deploy. Then confirm the folder contains index.html, .htaccess, favicon.svg and
      assets/. If .htaccess is missing, stop and tell me.
   3. Turn on Auto Deployment for this repository and copy the webhook URL. Report it to me; I
      add it to GitHub so every new build redeploys automatically.

D. HTTPS
   1. Security → SSL: install the free SSL certificate for jeopardy.danishali.dev (it can take a
      few minutes after DNS resolves).
   2. Turn on "Force HTTPS" for the subdomain.
   3. If the Hostinger CDN is on for this site, leave it on, but purge its cache after each deploy
      when testing.

E. DNS for the backend (pb-db.danishali.dev → my NAS)
   Domains → danishali.dev → DNS / Nameservers → DNS records → add:
   - If HOME_ADDRESS is a hostname (e.g. something.synology.me):
       Type CNAME | Name: pb-db | Target: <HOME_ADDRESS> | TTL 3600
   - If HOME_ADDRESS is an IPv4 address:
       Type A     | Name: pb-db | Points to: <HOME_ADDRESS> | TTL 3600
   Also check the zone's CAA records. If there are any, one must allow letsencrypt.org (the NAS
   gets its certificate from Let's Encrypt). If none allows it, tell me; don't edit CAA yourself.

F. Verify and report
   - https://jeopardy.danishali.dev loads a dark page titled "Buzzwire".
   - https://jeopardy.danishali.dev/room/ABCD/board also loads it (not a 404). This proves
     .htaccess works.
   - http://jeopardy.danishali.dev redirects to https.
   - pb-db.danishali.dev resolves publicly to HOME_ADDRESS (e.g. dig +short pb-db.danishali.dev).
   - The footer will say "Server unreachable" until the NAS part is finished. That's expected.
   Report: the subdomain's folder path, the Git deployment settings, the auto-deploy webhook URL,
   the DNS records added, the SSL status, and anything you couldn't do.
```

---

## Step 5: connect the auto-deploy webhook (GitHub)

So Hostinger redeploys whenever CI publishes a new frontend build, do **one** of these in the
GitHub repo (needs repo admin):

- **Recommended:** Settings → Secrets and variables → Actions → New repository secret:
  `HOSTINGER_DEPLOY_WEBHOOK` = the webhook URL from step 4C. CI calls it right after updating
  `frontend-dist`.
- **Or:** Settings → Webhooks → Add webhook: Payload URL = the webhook URL, "Just the push
  event". This fires on every push, including the `frontend-dist` update.

Without either, redeploy by clicking **Deploy** in hPanel → GIT after each change.

---

## Step 6: NAS agent, part B (HTTPS for the API)

> Same NAS agent, after the Hostinger step reports that `pb-db.danishali.dev` resolves.

```text
Continue the Buzzwire setup. DNS for pb-db.danishali.dev now points at my home address.

1. In Nginx Proxy Manager, add a Proxy Host:
   - Domain: pb-db.danishali.dev
   - Forward: http://<NAS LAN IP>:<PB_PORT>. Block common exploits: on. Websockets: off.
   - SSL: request a new Let's Encrypt certificate. Force SSL: on. HTTP/2: on.
   - Advanced tab → custom Nginx configuration:
       # Realtime uses server-sent events: don't buffer, keep idle streams open.
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 1h;
       proxy_send_timeout 1h;

       # PocketBase admin dashboard: home network only.
       location /_/ {
           allow 192.168.0.0/16;   # change to the actual LAN subnet
           deny all;
           include conf.d/include/proxy.conf;
       }
   If NPM rejects the Advanced config, remove only the location block, tell me, and continue.
2. Verify from outside the home network if you can (e.g. phone data, or an online checker):
   - https://pb-db.danishali.dev/api/health → 200 {"message":"API is healthy."...}
   - https://pb-db.danishali.dev/api/buzzwire/hello → 200 JSON
   - `curl -N https://pb-db.danishali.dev/api/realtime` prints "event:PB_CONNECT" immediately.
     If it hangs, buffering is still on.
   - https://pb-db.danishali.dev/_/ → 403 from outside, the PocketBase login from the LAN.
3. Don't forward <PB_PORT> on the router: only NPM may reach PocketBase (PocketBase trusts the
   X-Real-IP header NPM sets). Report what you did.
```

---

## Step 7: final checks

1. Open **https://jeopardy.danishali.dev** on a phone (mobile data, not Wi-Fi). The footer should
   say **"Server online"**.
2. Open https://jeopardy.danishali.dev/room/ABCD/play directly. It should show the Buzzer page,
   not a 404.
3. From home, open https://pb-db.danishali.dev/_/ and sign in with the superuser from step 3.

## Updating

- **Code:** push to `main`. CI rebuilds both; Hostinger redeploys via the webhook (or the Deploy
  button), and the NAS picks up the new image via the daily scheduled task, or right away with
  `docker compose pull && docker compose up -d` in `/volume1/docker/buzzwire`.
- **Roll back the API:** set `BUZZWIRE_TAG=<older commit sha>` in the NAS `.env`, then
  `docker compose up -d`.
- **Roll back the frontend:** re-run an older CI run on `main` (Actions → the run → Re-run jobs).
  It republishes that build to `frontend-dist`.

## Backups

PocketBase backs up `pb_data` nightly at 03:00 UTC, keeping 7, inside the Docker volume. Manage
them at https://pb-db.danishali.dev/_/ → Settings → Backups. To keep copies off the NAS, add S3
storage there or include the volume in Hyper Backup. The frontend needs no backup: it's rebuilt
from Git.

## Troubleshooting

| Symptom                                  | Likely cause / fix                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Footer says "Server unreachable"         | `https://pb-db.danishali.dev/api/health` fails: container not healthy, NPM host/cert missing, or 80/443 not forwarded. |
| `/room/ABCD/board` gives a Hostinger 404 | `.htaccess` missing from the subdomain folder, or Git deployed into the wrong folder.                                  |
| Old frontend after a push                | Webhook not set (step 5) → click Deploy in hPanel; purge the Hostinger CDN cache.                                      |
| Live updates lag or arrive in bursts     | NPM is buffering: add the Advanced config from step 6.                                                                 |
| NPM can't get a certificate for `pb-db`  | DNS not propagated yet, port 80 not forwarded, or a CAA record blocks Let's Encrypt.                                   |
| NAS can't pull the image ("denied")      | GHCR package still private: step 2.                                                                                    |
