# Deploying Buzzwire

Two services:

| Service    | Where                 | Address                              |
| ---------- | --------------------- | ------------------------------------ |
| Frontend   | Vercel                | `https://buzzwire.danishali.dev`     |
| PocketBase | Synology NAS (Docker) | `https://api.buzzwire.danishali.dev` |

DNS for `danishali.dev` is hosted at Hostinger (nameservers `ns1/ns2.dns-parking.com`).

## Order

Each step below is a self-contained prompt you can paste into an agent that has the right access.
Do them in this order, because each one needs something from the one before:

1. **Merge to `main`.** Vercel deploys `main` to production, and CI builds the PocketBase image
   from `main`. Until the rebuild is merged, there's nothing to deploy.
2. **Make the image public** (one click, below) so the NAS can pull it without a login.
3. **NAS agent:** runs PocketBase and finds the NAS's public address. → reports `HOME_ADDRESS`.
4. **Vercel agent:** creates the frontend project and domain. → reports `VERCEL_CNAME`.
5. **Hostinger agent:** adds the two DNS records using those values.
6. **NAS agent again:** issues the HTTPS certificate (it needs DNS from step 5 first).
7. **Check:** open `https://buzzwire.danishali.dev`. The footer should say "Server online".

### Step 2: make the image public

After the first push to `main`, CI publishes `ghcr.io/danish12196/buzzwire`. On GitHub: your
profile → **Packages** → **buzzwire** → **Package settings** → **Change visibility** → Public.
(Or skip this and the NAS agent will need a GitHub token with `read:packages`.)

---

## Prompt: NAS agent (steps 3 and 6)

> For an agent with SSH access to the Synology NAS (and, ideally, access to its DSM web UI and
> Nginx Proxy Manager).

```text
Set up the Buzzwire PocketBase server on my Synology DS923+ (x86_64), using Docker via Container
Manager, behind my existing Nginx Proxy Manager (NPM). Repo: https://github.com/Danish12196/jeopardy
(docker-compose.yml, docs/DEPLOY.md, and the "Self-hosting" section of README.md).

1. Create /volume1/docker/buzzwire. Put the repo's docker-compose.yml in it, plus a .env with:
     BUZZWIRE_IMAGE=ghcr.io/danish12196/buzzwire
     BUZZWIRE_TAG=latest
     BUZZWIRE_PORT=8090
   If port 8090 is already in use on the NAS, pick a free one and tell me which.
   Start it: `docker compose pull && docker compose up -d` (or as a Container Manager Project from
   that folder). If the pull is denied, the GHCR package is still private: stop and tell me.
2. Wait until `docker inspect -f '{{.State.Health.Status}}' buzzwire` is "healthy", then check
   `curl -s http://127.0.0.1:<port>/api/buzzwire/hello` returns {"message":"Hello from Buzzwire",...}.
3. Create the PocketBase superuser with a strong random password, and give me the email/password
   once (don't save it anywhere else):
     docker compose exec buzzwire /pb/pocketbase superuser upsert <my email> '<password>' --dir /pb/pb_data
4. Work out how the internet reaches this NAS, without changing anything yet:
   - Is NPM installed and running? Which ports does it listen on?
   - Are TCP 80 and 443 on the router forwarded to NPM? (Check existing NPM proxy hosts that
     already work from outside, e.g. Jellyfin.)
   - What's the public address: a DDNS hostname (DSM → External Access → DDNS, e.g.
     xxx.synology.me) or a static public IPv4? Is the home connection behind CGNAT?
   Report HOME_ADDRESS: the DDNS hostname if there is one (preferred), otherwise the public IPv4.
   If 80/443 can't reach NPM from the internet, stop and explain the options.
5. STOP here and report: the port used, HOME_ADDRESS, and whether 80/443 reach NPM. DNS has to be
   set up before the certificate step.

--- Second run, after I tell you DNS is in place ---

6. In NPM, add a Proxy Host:
   - Domain: api.buzzwire.danishali.dev
   - Forward to: http://<NAS LAN IP>:<port>. Block common exploits: on. Websockets: off.
   - SSL: request a Let's Encrypt certificate, Force SSL on, HTTP/2 on.
   - Advanced tab, custom nginx config:
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 1h;
       proxy_send_timeout 1h;
       location /_/ {
           allow 192.168.0.0/16;   # change to the actual LAN subnet
           deny all;
           include conf.d/include/proxy.conf;
       }
7. Verify from outside the LAN if possible:
   - https://api.buzzwire.danishali.dev/api/health → 200 JSON
   - https://api.buzzwire.danishali.dev/api/buzzwire/hello → 200 JSON
   - https://api.buzzwire.danishali.dev/api/realtime streams an "event:PB_CONNECT" line straight
     away (curl -N); if it hangs, buffering is still on.
   - https://api.buzzwire.danishali.dev/_/ from outside the LAN → 403
   If NPM rejects the Advanced config, remove only the location block, tell me, and continue.
8. Don't expose port <port> on the router; only NPM should reach it. Report what you did.
```

## Prompt: Vercel agent (step 4)

> For an agent with access to my Vercel account (team "Danish's projects"), e.g. Claude with the
> Vercel connector.

```text
Create the Buzzwire frontend on Vercel in my team "Danish's projects"
(team_L5B9lLTWXTXpxsQnIsQzmOo7).

1. Create a project named "buzzwire", connected to the GitHub repo Danish12196/jeopardy,
   production branch main. Root directory: repo root. vercel.json in the repo sets framework
   (vite), install (npm ci), build (npm run build) and output (dist), so leave those on defaults.
   If Vercel can't see the repo, the Vercel GitHub app needs access to it: tell me the exact link
   to grant it.
2. Environment variable, for Production and Preview:
     VITE_PB_URL = https://api.buzzwire.danishali.dev
3. Add the domain buzzwire.danishali.dev to the project (production). danishali.dev is already
   in the team but its DNS is at Hostinger, so it will show as misconfigured until DNS is added.
   Report the exact CNAME target Vercel asks for (VERCEL_CNAME), e.g. cname.vercel-dns.com or a
   project-specific *.vercel-dns-0xx.com value, plus any TXT verification record it requests.
4. Trigger a production deployment of main and report whether the build passed and its
   *.vercel.app URL.
```

## Prompt: Hostinger DNS agent (step 5)

> For an agent with access to my Hostinger account (hPanel → Domains → danishali.dev → DNS / Nameservers).

```text
Add DNS records for danishali.dev in Hostinger. Don't change, delete or replace any existing
records, and don't change the nameservers.

1. Frontend (Vercel):
     Type CNAME, Name: buzzwire, Target: <VERCEL_CNAME from the Vercel step>, TTL 3600
   If Vercel asked for a TXT verification record, add it exactly as given.
2. API (home NAS):
   - If HOME_ADDRESS is a hostname (e.g. something.synology.me):
       Type CNAME, Name: api.buzzwire, Target: <HOME_ADDRESS>, TTL 3600
   - If HOME_ADDRESS is an IPv4 address:
       Type A, Name: api.buzzwire, Points to: <HOME_ADDRESS>, TTL 3600
3. Before adding, check there's no existing record named "buzzwire", "api.buzzwire", or a wildcard
   "*" that conflicts. If there is, stop and tell me rather than overwriting it.
4. Report the records as saved, then confirm they resolve publicly, e.g.:
     dig +short buzzwire.danishali.dev CNAME
     dig +short api.buzzwire.danishali.dev
```

---

## After it's live

- **Updates:** push to `main`. Vercel redeploys the frontend by itself. For the backend, run
  `docker compose pull && docker compose up -d` in `/volume1/docker/buzzwire` on the NAS.
- **Backups:** nightly at 03:00 UTC into the `pb_data` volume (7 kept). Manage them in the
  dashboard at `https://api.buzzwire.danishali.dev/_/` (from your home network).
- **If the frontend says "Server unreachable":** check the container is healthy on the NAS, then
  that `https://api.buzzwire.danishali.dev/api/health` loads.
