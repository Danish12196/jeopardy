import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || "https://pb-database.danishandarwa.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "YOUR_ADMIN_EMAIL";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "YOUR_ADMIN_PASSWORD";

const pb = new PocketBase(PB_URL);

async function init() {
  console.log(`Connecting to ${PB_URL}...`);
  try {
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("Authenticated as Admin successfully.");
  } catch (err) {
    console.error("Failed to authenticate as admin. Check your credentials.");
    process.exit(1);
  }

  const collections = [
    {
      name: "teams",
      type: "base",
      schema: [
        { name: "name", type: "text", required: true }
      ],
      listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: ""
    },
    {
      name: "question_categories",
      type: "base",
      schema: [
        { name: "name", type: "text", required: true },
        { name: "difficulty", type: "select", options: { maxSelect: 1, values: ["Easy", "Medium", "Hard"] } },
        { name: "isPublic", type: "bool" }
      ],
      listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: ""
    },
    {
      name: "questions",
      type: "base",
      schema: [
        { name: "question", type: "text", required: true },
        { name: "answer", type: "text", required: true },
        { name: "hint", type: "text" },
        { name: "value", type: "number" },
        { name: "category", type: "relation", required: true, options: { collectionId: "", cascadeDelete: false, minSelect: 1, maxSelect: 1, displayFields: [] } },
        { name: "difficulty", type: "number" }
      ],
      listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: ""
    },
    {
      name: "game_templates",
      type: "base",
      schema: [
        { name: "title", type: "text", required: true },
        { name: "categories", type: "relation", options: { collectionId: "", cascadeDelete: false, minSelect: null, maxSelect: null, displayFields: [] } },
        { name: "questions", type: "relation", options: { collectionId: "", cascadeDelete: false, minSelect: null, maxSelect: null, displayFields: [] } }
      ],
      listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: ""
    },
    {
      name: "games",
      type: "base",
      schema: [
        { name: "title", type: "text" },
        { name: "uniqueID", type: "text", required: true },
        { name: "template", type: "relation", options: { collectionId: "", cascadeDelete: false, minSelect: null, maxSelect: 1, displayFields: [] } },
        { name: "teams", type: "relation", options: { collectionId: "", cascadeDelete: false, minSelect: null, maxSelect: null, displayFields: [] } },
        { name: "categories", type: "json" },
        { name: "values", type: "json" },
        { name: "teamScores", type: "json" },
        { name: "answeredQuestions", type: "json" },
        { name: "buzzerQueue", type: "json" },
        { name: "currentActiveQuestion", type: "text" },
        { name: "currentActiveTeam", type: "text" },
        { name: "showAnswer", type: "bool" },
        { name: "buzzerUnlocked", type: "bool" }
      ],
      listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: ""
    }
  ];

  for (const coll of collections) {
    try {
      console.log(`Creating collection: ${coll.name}...`);
      await pb.collections.create(coll);
      console.log(`Successfully created ${coll.name}.`);
    } catch (err) {
      console.error(`Error creating ${coll.name}: it may already exist or there is a schema issue.`);
    }
  }

  console.log("Database Setup Attempt Complete. Please manually verify relations in PocketBase Admin UI.");
}

init();
