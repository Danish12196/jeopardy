# Lockout v2 notes

Working notes for the `v2` branch. The final summary, skipped items and the
production upgrade steps are filled in at the end.

## Done

### Phase 1: test harness
- Vitest (`npm test`) and Playwright (`npm run e2e`).
- `scripts/test-pb.mjs` runs a throwaway PocketBase (v0.29.3 by default, set
  `PB_VERSION` to change) from `.pb/`, runs `init-db.mjs --sync-rules` and
  `seed-test.mjs`, then runs the given command against it.
- `seed-test.mjs` now creates a test host account (`host@lockout.test`) and
  four teams, and sets `user` on the seeded content (the field is required).
- GitHub Actions workflow `.github/workflows/ci.yml`.

### Phase 2: buzzer
- New `buzzes` collection (game, team, round, created) with a unique index
  on (game, round, team). Guests can only create a buzz while the game is
  open, for the current `buzzRound`, for a team in that game. No guest
  update or delete.
- New `games.buzzRound`. Opening, resetting or moving on from the buzzers
  increments it with `buzzRound+` (atomic on the server).
- Order is the server's `created` time, ties broken by id. Phones never send
  a time.
- Guests can no longer write to `games` at all (`GUEST_BUZZ` removed).
- **`games.buzzerQueue` is deprecated.** It stays in the schema and is still
  readable for one release so old clients don't crash, but nothing writes to
  it any more. Remove the field in the release after v2.

## Open questions
- Production's PocketBase version isn't known here. Tests use v0.29.3; the
  rules only use features from v0.23+ (`:isset`, `?=`, `buzzRound+`
  modifiers, autodate, unique indexes).
