// Creates or updates the PocketBase collections the Lockout app needs.
// Targets PocketBase v0.23+ (superusers, `fields` schema, batch API).
//
// Usage (from the repo root, any machine with Node 18+):
//   PB_URL=https://pb.example.com \
//   PB_SUPERUSER_EMAIL=you@example.com \
//   PB_SUPERUSER_PASSWORD='...' \
//   node scripts/init-db.mjs [--dry-run] [--sync-rules]
//
// Safe to re-run: existing collections are kept, and only missing fields are added.
// Existing fields and data are never changed or deleted. Access rules are set on
// new collections; pass --sync-rules to also apply them to existing ones.

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL;
const EMAIL = process.env.PB_SUPERUSER_EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD || process.env.ADMIN_PASSWORD;
const DRY_RUN = process.argv.includes("--dry-run");
const SYNC_RULES = process.argv.includes("--sync-rules");

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error("Set PB_URL, PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Rules: "" = anyone (incl. guests), null = superusers only, otherwise a filter.
// Superusers (the _superusers collection) bypass every rule, so rules never
// mention them. Anyone can read what players and the board need; only the
// owner can change their own content.
const LOGGED_IN = '@request.auth.id != ""';
// The record's owner field must be the caller, on create and on any update
// that sends it, so nobody can create content as someone else or hand it over.
const owns = (field) => `${LOGGED_IN} && ${field} = @request.auth.id`;
const keepsOwner = (field) =>
  `(@request.body.${field}:isset = false || @request.body.${field} = @request.auth.id)`;
const AUTHOR_RULES = {
  listRule: "isPublic = true || (@request.auth.id != \"\" && user = @request.auth.id)",
  viewRule: "isPublic = true || (@request.auth.id != \"\" && user = @request.auth.id)",
  createRule: owns("user"),
  updateRule: `${owns("user")} && ${keepsOwner("user")}`,
  deleteRule: owns("user"),
};

// Teams: you only list your own (the setup page relies on this rule instead of
// a client filter), but anyone can view one by id so the TV board and phone
// buzzers can show team names.
const TEAM_RULES = {
  ...AUTHOR_RULES,
  // The auth check matters: guests have an empty auth id, which would match
  // teams saved without an owner.
  listRule: owns("user"),
  viewRule: "",
};

// Games: anyone can read (the TV board and phones aren't logged in). Only the
// game's host can change or delete it. Guests can't write to a game at all;
// phones buzz by creating a `buzzes` record. `buzzerQueue` is kept (read-only,
// no longer written) for one release so old clients don't crash.
const GAME_RULES = {
  listRule: "",
  viewRule: "",
  createRule: owns("host"),
  updateRule: `${owns("host")} && ${keepsOwner("host")}`,
  deleteRule: owns("host"),
};

// Buzzes: one record per team per buzz round. Anyone can create one, but
// only while the game's buzzers are open, only for the game's current round,
// and only for a team that is in that game. The server sets `created`, which
// decides the order. Nobody but a superuser can change or delete a buzz.
const BUZZ_RULES = {
  listRule: "",
  viewRule: "",
  createRule:
    "game.buzzerUnlocked = true && round = game.buzzRound && game.teams.id ?= team",
  updateRule: null,
  deleteRule: null,
};

// All In wagers: phones (guests) place one wager per team while the game is
// in its wager phase. Only the host can see them until the reveal starts.
const WAGER_RULES = {
  listRule: 'game.host = @request.auth.id || game.allInPhase = "reveal" || game.allInPhase = "done"',
  viewRule: 'game.host = @request.auth.id || game.allInPhase = "reveal" || game.allInPhase = "done"',
  createRule: 'game.allInPhase = "wager" && game.teams.id ?= team && amount >= 0',
  updateRule: null,
  deleteRule: null,
};

const timestamps = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const relation = (name, target, { single = false, required = false, cascade = false } = {}) => ({
  name,
  type: "relation",
  required,
  collectionId: `@${target}`, // resolved to a real id below
  cascadeDelete: cascade,
  minSelect: 0,
  maxSelect: single ? 1 : 999,
});

// Order matters: a collection must come after anything it relates to.
const COLLECTIONS = [
  {
    name: "users",
    rules: {
      // You can list yourself; logged-in users can view others by id (the
      // template picker shows the author's name).
      listRule: "id = @request.auth.id",
      viewRule: LOGGED_IN,
      // Anyone can register, but nobody can set the old isSuperuser flag.
      createRule: "@request.body.isSuperuser:isset = false",
      updateRule: "id = @request.auth.id && @request.body.isSuperuser:isset = false",
      deleteRule: "id = @request.auth.id",
    },
    fields: [
      { name: "username", type: "text" },
      // Deprecated: rules used to trust this user-settable flag. No rule reads
      // it any more; kept so existing data isn't dropped.
      { name: "isSuperuser", type: "bool" },
    ],
    isAuth: true,
  },
  {
    name: "teams",
    rules: TEAM_RULES,
    fields: [
      { name: "name", type: "text", required: true },
      relation("user", "users", { single: true, required: true }),
      { name: "isPublic", type: "bool" },
    ],
  },
  {
    name: "question_categories",
    rules: AUTHOR_RULES,
    fields: [
      { name: "name", type: "text", required: true },
      { name: "difficulty", type: "select", maxSelect: 1, values: ["Easy", "Medium", "Hard"] },
      { name: "isPublic", type: "bool" },
      relation("user", "users", { single: true, required: true }),
    ],
  },
  {
    name: "questions",
    rules: AUTHOR_RULES,
    fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "text", required: true },
      { name: "hint", type: "text" },
      { name: "value", type: "number" },
      relation("category", "question_categories", { single: true, required: true }),
      { name: "difficulty", type: "number" },
      { name: "isPublic", type: "bool" },
      relation("user", "users", { single: true, required: true }),
    ],
  },
  {
    name: "game_templates",
    rules: AUTHOR_RULES,
    fields: [
      { name: "title", type: "text", required: true },
      relation("categories", "question_categories"),
      relation("questions", "questions"),
      { name: "isPublic", type: "bool" },
      relation("user", "users", { single: true, required: true }),
    ],
  },
  {
    name: "games",
    rules: GAME_RULES,
    fields: [
      { name: "title", type: "text" },
      { name: "uniqueID", type: "text", required: true },
      relation("template", "game_templates", { single: true }),
      // The user running the game. Set on create; backfilled below for
      // older games from the template's owner.
      relation("host", "users", { single: true }),
      relation("teams", "teams"),
      { name: "categories", type: "json", maxSize: 0 },
      { name: "values", type: "json", maxSize: 0 },
      { name: "teamScores", type: "json", maxSize: 0 },
      { name: "answeredQuestions", type: "json", maxSize: 0 },
      { name: "buzzerQueue", type: "json", maxSize: 0 },
      { name: "currentActiveQuestion", type: "text" },
      { name: "currentActiveTeam", type: "text" },
      { name: "showAnswer", type: "bool" },
      { name: "buzzerUnlocked", type: "bool" },
      { name: "hostForceShowQuestion", type: "bool" },
      // Goes up by one each time the host opens, resets or moves on from the
      // buzzers. Buzzes from an older round are ignored and can't be created.
      { name: "buzzRound", type: "number", onlyInt: true },
      // Score changes the host can undo (newest last), kept with the game so
      // a reload doesn't lose them.
      { name: "scoreHistory", type: "json", maxSize: 0 },
      // Wildcard tiles (question ids) and the one being played:
      // { question, team, wager, resolved }.
      { name: "wildcards", type: "json", maxSize: 0 },
      { name: "wildcard", type: "json", maxSize: 0 },
      // All In: "" (not started), "wager", "question", "reveal" or "done", plus
      // { category, question, answer, results: {teamId: bool}, order: [teamId], revealed }.
      { name: "allInPhase", type: "text" },
      { name: "allIn", type: "json", maxSize: 0 },
      { name: "gameOver", type: "bool" },
      { name: "settings", type: "json", maxSize: 0 },
      { name: "passedTeams", type: "json", maxSize: 0 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_games_unique_id` ON `games` (`uniqueID`)",
    ],
  },
  {
    name: "buzzes",
    rules: BUZZ_RULES,
    fields: [
      relation("game", "games", { single: true, required: true, cascade: true }),
      relation("team", "teams", { single: true, required: true, cascade: true }),
      { name: "round", type: "number", onlyInt: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_buzzes_game_round_team` ON `buzzes` (`game`, `round`, `team`)",
    ],
  },
  {
    name: "wagers",
    rules: WAGER_RULES,
    fields: [
      relation("game", "games", { single: true, required: true, cascade: true }),
      relation("team", "teams", { single: true, required: true, cascade: true }),
      { name: "amount", type: "number", onlyInt: true, min: 0 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_wagers_game_team` ON `wagers` (`game`, `team`)",
    ],
  },
];

// Index name from a CREATE INDEX statement, used to tell which ones exist.
const indexName = (sql) => sql.match(/INDEX\s+(?:IF NOT EXISTS\s+)?`?([\w]+)`?/i)?.[1];

const ids = {}; // collection name -> id

function resolve(field) {
  if (field.type !== "relation") return field;
  const target = field.collectionId.slice(1);
  if (target === "users") {
      ids[target] = "_pb_users_auth_";
      return { ...field, collectionId: "_pb_users_auth_" };
  }
  if (!ids[target]) throw new Error(`Relation "${field.name}" points at unknown collection "${target}"`);
  return { ...field, collectionId: ids[target] };
}

async function findCollection(name) {
  try {
    return await pb.collections.getOne(name === "users" ? "_pb_users_auth_" : name);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function upsert(def) {
  const isUsers = def.name === "users";
  const nameToUse = isUsers ? "_pb_users_auth_" : def.name;

  if (isUsers) {
      ids["users"] = "_pb_users_auth_";
  }

  // Handle Auth collections specially, we don't create them, they exist
  // We just patch their fields if missing
  const desired = isUsers ? [...def.fields] : [...def.fields, ...timestamps].map(resolve);
  const existing = await findCollection(def.name);

  if (!existing && !isUsers) {
    console.log(`+ create ${def.name} (${desired.length} fields)`);
    if (DRY_RUN) {
      ids[def.name] = `<new:${def.name}>`;
      return;
    }
    const created = await pb.collections.create({
      name: def.name,
      type: "base",
      fields: desired,
      indexes: def.indexes || [],
      ...def.rules,
    });
    ids[def.name] = created.id;
    return;
  }

  if (!existing && isUsers) {
      // It should exist by default in pocketbase
      throw new Error("Users collection not found");
  }

  if (!isUsers) {
      ids[def.name] = existing.id;
  }

  const have = new Set(existing.fields.map((f) => f.name));
  const missing = desired.filter((f) => !have.has(f.name));

  // Warn about type mismatches instead of silently changing live fields.
  for (const f of desired) {
    const cur = existing.fields.find((e) => e.name === f.name);
    if (cur && cur.type !== f.type) {
      console.warn(`! ${def.name}.${f.name} is "${cur.type}" on the server, script expects "${f.type}" (left unchanged)`);
    }
  }

  const differentRules = Object.keys(def.rules).filter((k) => existing[k] !== def.rules[k]);
  const ruleChanges = SYNC_RULES ? differentRules : [];
  if (!SYNC_RULES && differentRules.length) {
    console.warn(`! ${def.name}: ${differentRules.join(", ")} differ from this script (re-run with --sync-rules to apply)`);
  }

  const haveIndexes = new Set((existing.indexes || []).map(indexName));
  const missingIndexes = (def.indexes || []).filter((sql) => !haveIndexes.has(indexName(sql)));

  if (!missing.length && !ruleChanges.length && !missingIndexes.length) {
    console.log(`= ${def.name} already up to date`);
    return;
  }
  if (missing.length) console.log(`~ ${def.name}: add ${missing.map((f) => f.name).join(", ")}`);
  if (missingIndexes.length) console.log(`~ ${def.name}: add index ${missingIndexes.map(indexName).join(", ")}`);
  if (ruleChanges.length) console.log(`~ ${def.name}: update ${ruleChanges.join(", ")}`);
  if (!DRY_RUN) {
    const patch = {};
    if (missing.length) patch.fields = [...existing.fields, ...missing];
    if (missingIndexes.length) patch.indexes = [...(existing.indexes || []), ...missingIndexes];
    for (const k of ruleChanges) patch[k] = def.rules[k];
    await pb.collections.update(existing.id, patch);
  }
}

// Games created before `host` existed get their template's owner as host, so
// they stay editable. Games whose template is gone stay host-less (superuser
// only) and are listed.
async function backfillGameHosts() {
  const games = await findCollection("games");
  if (!games) return; // dry run on an empty database
  const hasHost = games.fields.some((f) => f.name === "host");
  const list = await pb.collection("games").getFullList({
    fields: hasHost ? "id,uniqueID,host,template" : "id,uniqueID,template",
    ...(hasHost ? { filter: 'host = ""' } : {}),
  });
  if (!list.length) return;
  const templates = new Map();
  let fixed = 0;
  const orphans = [];
  for (const g of list) {
    if (!g.template) { orphans.push(g.uniqueID); continue; }
    if (!templates.has(g.template)) {
      try {
        templates.set(g.template, (await pb.collection("game_templates").getOne(g.template, { fields: "user" })).user);
      } catch {
        templates.set(g.template, "");
      }
    }
    const owner = templates.get(g.template);
    if (!owner) { orphans.push(g.uniqueID); continue; }
    fixed++;
    if (!DRY_RUN) await pb.collection("games").update(g.id, { host: owner });
  }
  if (fixed) console.log(`~ games: set host on ${fixed} existing game(s) from the template owner`);
  if (orphans.length) {
    console.warn(`! games: ${orphans.length} game(s) have no template owner and stay superuser-only: ${orphans.join(", ")}`);
  }
}

async function main() {
  console.log(`Connecting to ${PB_URL}${DRY_RUN ? " (dry run, nothing will be changed)" : ""}`);
  await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
  console.log("Authenticated as superuser.");

  for (const def of COLLECTIONS) {
    await upsert(def);
  }

  await backfillGameHosts();

  // The bulk-question form uses the batch API, which is off by default.
  const settings = await pb.settings.getAll();
  if (!settings.batch?.enabled) {
    console.log("~ enable batch API (needed by the bulk question form)");
    if (!DRY_RUN) {
      await pb.settings.update({ batch: { ...settings.batch, enabled: true, maxRequests: settings.batch?.maxRequests || 50 } });
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err?.response?.message || err.message);
  if (err?.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
