# Lockout

**Buzz first or sit it out.**

Lockout is a quiz night game for one TV and everyone's phone, built with React + Vite and PocketBase. The host runs the board, the TV shows the questions, and each team buzzes in from a phone. Buzzers stay locked until the host opens them, and the first phone in wins the chance to answer.

## Features

- Build a board from your own categories and questions and save it as a template, or import a whole board from CSV or JSON (with a preview and clear errors before anything is saved). Export any template back to CSV or JSON.
- Add and name multiple teams
- TV board view with question reveal and live scores
- Host dashboard with the answer, the buzz queue and scoring
- Phone buzzers that show **Locked** and **Open** states in real time, vibrate on a tap and show "Buzzed #2" once the server confirms the order
- Fair buzzing: the server decides the order, so phone clocks don't matter and simultaneous buzzes are never lost
- **Undo** the last score change, and adjust any team's score by hand
- **Wildcard** tiles: the host marks any tiles; the team that picks one wagers and plays alone
- **All In**: a last question where every team wagers on their phone, hidden until the TV reveals each team one at a time
- **Game over** screen on the TV with final standings
- Phones, TV and host recover on their own after a network drop or a sleeping screen, with a small "Reconnecting…" badge meanwhile. A phone that reloads keeps its team, and can switch teams.

## Brand

| Token | Value |
| --- | --- |
| Signal orange (accent) | `#FF5A1F` |
| Charcoal (background) | `#1C1C1E` |
| Off-white (text) | `#F4F1EA` |

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Set `VITE_PB_URL` in `.env` to your PocketBase (see `env-sample`).

## Tests

```bash
npm test        # unit tests (Vitest)
npm run e2e     # end-to-end tests (Playwright) against a throwaway local PocketBase
npm run lint
npm run build
```

`npm run e2e` runs `scripts/test-pb.mjs`, which downloads PocketBase into `.pb/` (gitignored; set `PB_VERSION` to pick a version), starts it on a free port with a temporary data dir, creates a superuser, runs `init-db.mjs --sync-rules` and `seed-test.mjs`, starts Vite against it, runs Playwright and tears everything down. It never touches a real server. `npm run pb:test` starts the same throwaway PocketBase and leaves it running so you can poke at it (Ctrl+C to stop).

The seeded test host is `host@lockout.test` / `lockout-host-password`, with four teams and a "Test Board" template.

CI (`.github/workflows/ci.yml`) runs build, lint, unit and E2E tests on every pull request.

## Database setup and upgrades

The app expects a PocketBase (v0.23+) server. `scripts/init-db.mjs` creates or upgrades the collections, fields, indexes and access rules, and turns on the batch API:

```bash
PB_URL=https://pb.example.com PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD='...' \
  node scripts/init-db.mjs --dry-run --sync-rules   # preview
PB_URL=... node scripts/init-db.mjs --sync-rules    # apply
```

Re-running is safe. It adds missing collections, fields and indexes and never deletes or changes existing data or field types. Access rules on existing collections only change with `--sync-rules` (without it, the script warns about rules that differ). It also backfills `games.host` for older games from their template's owner.

## How the buzzer works

Each buzz is its own record in the `buzzes` collection (`game`, `team`, `round`, and the server-set `created` time), with a unique index on `(game, round, team)`. The game has a `buzzRound` number. When the host opens, clears or moves on from the buzzers, the host app increments `buzzRound` (atomically, with PocketBase's `buzzRound+` modifier) instead of clearing a list. A phone buzzes by creating a record for the current round. The access rule only allows that while the game's buzzers are open, for the game's current round, and for a team in that game, and guests can't update or delete buzzes or touch the game record at all. The order is the server's `created` time (ties broken by record id), so phone clocks play no part and two teams buzzing at once both land. Host, TV and phones subscribe to `buzzes` for the game and show the current round's queue; after any reconnect they refetch it.

## Contribution

Contributions are welcome! Please feel free to submit a Pull Request.
