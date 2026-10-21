// Creates or updates the PocketBase collections the Jeopardy app needs.
// Targets PocketBase v0.23+ (superusers, `fields` schema, batch API).
//
// Usage (from the repo root, any machine with Node 18+):
//   PB_URL=https://pb.example.com \
//   PB_SUPERUSER_EMAIL=you@example.com \
//   PB_SUPERUSER_PASSWORD='...' \
//   node scripts/init-db.mjs [--dry-run]
//
// Safe to re-run: existing collections are kept, and only missing fields are added.
// Existing fields, rules and data are never changed or deleted.

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL;
const EMAIL = process.env.PB_SUPERUSER_EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD || process.env.ADMIN_PASSWORD;
const DRY_RUN = process.argv.includes("--dry-run");

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error("Set PB_URL, PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// Rules: "" = anyone (incl. guests) can do it; null = superusers only.
// These match what the app currently relies on. Tighten before going public.
const OPEN_RULES = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };

const timestamps = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const relation = (name, target, { single = false, required = false } = {}) => ({
  name,
  type: "relation",
  required,
  collectionId: `@${target}`, // resolved to a real id below
  cascadeDelete: false,
  minSelect: 0,
  maxSelect: single ? 1 : 999,
});

// Order matters: a collection must come after anything it relates to.
const COLLECTIONS = [
  {
    name: "teams",
    fields: [{ name: "name", type: "text", required: true }],
  },
  {
    name: "question_categories",
    fields: [
      { name: "name", type: "text", required: true },
      { name: "difficulty", type: "select", maxSelect: 1, values: ["Easy", "Medium", "Hard"] },
      { name: "isPublic", type: "bool" },
    ],
  },
  {
    name: "questions",
    fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "text", required: true },
      { name: "hint", type: "text" },
      { name: "value", type: "number" },
      relation("category", "question_categories", { single: true, required: true }),
      { name: "difficulty", type: "number" },
    ],
  },
  {
    name: "game_templates",
    fields: [
      { name: "title", type: "text", required: true },
      relation("categories", "question_categories"),
      relation("questions", "questions"),
    ],
  },
  {
    name: "games",
    fields: [
      { name: "title", type: "text" },
      { name: "uniqueID", type: "text", required: true },
      relation("template", "game_templates", { single: true }),
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
    ],
  },
];

const ids = {}; // collection name -> id

function resolve(field) {
  if (field.type !== "relation") return field;
  const target = field.collectionId.slice(1);
  if (!ids[target]) throw new Error(`Relation "${field.name}" points at unknown collection "${target}"`);
  return { ...field, collectionId: ids[target] };
}

async function findCollection(name) {
  try {
    return await pb.collections.getOne(name);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function upsert(def) {
  const desired = [...def.fields, ...timestamps].map(resolve);
  const existing = await findCollection(def.name);

  if (!existing) {
    console.log(`+ create ${def.name} (${desired.length} fields)`);
    if (DRY_RUN) {
      ids[def.name] = `<new:${def.name}>`;
      return;
    }
    const created = await pb.collections.create({ name: def.name, type: "base", fields: desired, ...OPEN_RULES });
    ids[def.name] = created.id;
    return;
  }

  ids[def.name] = existing.id;
  const have = new Set(existing.fields.map((f) => f.name));
  const missing = desired.filter((f) => !have.has(f.name));

  // Warn about type mismatches instead of silently changing live fields.
  for (const f of desired) {
    const cur = existing.fields.find((e) => e.name === f.name);
    if (cur && cur.type !== f.type) {
      console.warn(`! ${def.name}.${f.name} is "${cur.type}" on the server, script expects "${f.type}" (left unchanged)`);
    }
  }

  if (!missing.length) {
    console.log(`= ${def.name} already up to date`);
    return;
  }
  console.log(`~ ${def.name}: add ${missing.map((f) => f.name).join(", ")}`);
  if (!DRY_RUN) {
    await pb.collections.update(existing.id, { fields: [...existing.fields, ...missing] });
  }
}

async function main() {
  console.log(`Connecting to ${PB_URL}${DRY_RUN ? " (dry run, nothing will be changed)" : ""}`);
  await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
  console.log("Authenticated as superuser.");

  for (const def of COLLECTIONS) {
    await upsert(def);
  }

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
