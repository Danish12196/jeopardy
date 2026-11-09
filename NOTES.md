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

### Phase 3: permissions
Superusers bypass every rule in PocketBase, so rules no longer mention them.
- **users**: `isSuperuser` was a normal field a user could set when
  registering (create rule was `""`), and every content rule trusted
  `@request.auth.isSuperuser = true`. Anyone could register as a "superuser"
  and edit or delete everything. Create and update now refuse
  `isSuperuser`, and no rule reads it. List is limited to yourself; view
  needs a login (the template picker shows author names).
- **games**: new `host` relation. Create needs `host = you`; update and
  delete are host-only; the host can't be changed to someone else. Existing
  games get their template's owner as host (games with no template stay
  superuser-only and init-db lists them).
- **teams, question_categories, questions, game_templates**: create now
  requires `user = you` (before, any logged-in user could create content
  attributed to someone else), and updates can't change `user`.
- `GameHost` shows "Not your game" instead of controls that would all fail.
- Tests: `e2e/permissions.spec.ts` (second user vs first user's game,
  template, questions, categories and teams; isSuperuser escalation) and
  `e2e/upgrade.spec.ts` (old init-db, then new one: data kept, host
  backfilled, dry run changes nothing, second run is a no-op).

### Phase 4: boards in and out
- Setup page has an **Import / Export** tab. Export any template you can see
  as CSV (`category,value,question,answer,hint`) or JSON. Import a CSV or
  JSON file, see a preview table and a list of problems (missing answer or
  question, duplicate value in a category, wrong column count, bad header or
  value) before saving. Saving creates new categories, questions and a
  template owned by you.
- `samples/board.csv` and `samples/board.json`: one full 6x5 board.
- Unit tests for the parser (`src/lib/boardFile.test.ts`), E2E for importing
  the sample, exporting it again, and playing a question from it.
- Fixed a TV race: the board subscribed before its questions loaded, so a
  question opened in the first moments didn't show. It now subscribes after
  loading and refetches once subscribed.

## Open questions
- Production's PocketBase version isn't known here. Tests use v0.29.3; the
  rules only use features from v0.23+ (`:isset`, `?=`, `buzzRound+`
  modifiers, autodate, unique indexes).
- `games` can still be listed by anyone, so game codes are enumerable.
  Phones look games up by code without logging in, and PocketBase rules
  can't require a filter. After v2 guests can't write to a game, so the risk
  is low. Left as is.
- Anyone with a game code can buzz as any team in that game (teams have no
  login). Same as before; not changed.
- A private template's questions can't be loaded by a logged-out TV. That
  was already the case; opening the TV in the host's logged-in browser
  works. Not changed, because opening it up would leak answers. The import
  E2E test ticks "Make Public" for this reason. If you'd rather private
  boards work on a logged-out TV, the questions/categories/templates view
  rule can allow records used by a game, at the cost of answers being
  readable by anyone who knows the game exists.
