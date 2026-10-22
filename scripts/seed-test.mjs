// Adds test data: 4 categories x 3 questions, plus a "Test Board" template.
// Run after init-db.mjs, with the same env vars:
//   PB_URL, PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD
// Safe to re-run: categories and the template are matched by name and reused.

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL;
const EMAIL = process.env.PB_SUPERUSER_EMAIL;
const PASSWORD = process.env.PB_SUPERUSER_PASSWORD;

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error("Set PB_URL, PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.");
  process.exit(1);
}

const TEMPLATE_TITLE = "Test Board";

const DATA = [
  {
    name: "Science",
    difficulty: "Easy",
    questions: [
      ["What planet is known as the Red Planet?", "Mars", "Fourth planet from the Sun"],
      ["What gas do plants absorb from the air for photosynthesis?", "Carbon dioxide", "CO₂"],
      ["What is the chemical symbol for gold?", "Au", "From the Latin 'aurum'"],
    ],
  },
  {
    name: "Geography",
    difficulty: "Easy",
    questions: [
      ["What is the capital of Japan?", "Tokyo", "Formerly called Edo"],
      ["Which river flows through Cairo?", "The Nile", "The longest river in Africa"],
      ["What is the smallest country in the world by area?", "Vatican City", "It's inside Rome"],
    ],
  },
  {
    name: "Tech",
    difficulty: "Medium",
    questions: [
      ["What does HTML stand for?", "HyperText Markup Language", "Starts with 'HyperText'"],
      ["Who created the Linux kernel?", "Linus Torvalds", "A Finnish engineer"],
      ["What is the binary number 1010 in decimal?", "10", "8 + 2"],
    ],
  },
  {
    name: "UAE",
    difficulty: "Easy",
    questions: [
      ["What is the capital of the UAE?", "Abu Dhabi", "Not Dubai"],
      ["How many emirates make up the UAE?", "Seven", "Fewer than ten"],
      ["What is the tallest building in the world, located in Dubai?", "Burj Khalifa", "Opened in 2010"],
    ],
  },
];

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

const esc = (s) => s.replace(/"/g, '\\"');

async function findFirst(collection, filter) {
  try {
    return await pb.collection(collection).getFirstListItem(filter);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function main() {
  await pb.collection("_superusers").authWithPassword(EMAIL, PASSWORD);
  console.log(`Connected to ${PB_URL}`);

  const categoryIds = [];
  const questionIds = [];

  for (const cat of DATA) {
    let record = await findFirst("question_categories", `name = "${esc(cat.name)}"`);
    if (record) {
      console.log(`= category ${cat.name} exists`);
    } else {
      record = await pb.collection("question_categories").create({
        name: cat.name,
        difficulty: cat.difficulty,
        isPublic: true,
      });
      console.log(`+ category ${cat.name}`);
    }
    categoryIds.push(record.id);

    for (const [i, [question, answer, hint]] of cat.questions.entries()) {
      let q = await findFirst(
        "questions",
        `category = "${record.id}" && question = "${esc(question)}"`
      );
      if (!q) {
        q = await pb.collection("questions").create({
          question,
          answer,
          hint,
          value: (i + 1) * 100,
          difficulty: i + 1,
          category: record.id,
        });
        console.log(`  + ${question}`);
      }
      questionIds.push(q.id);
    }
  }

  const existing = await findFirst("game_templates", `title = "${TEMPLATE_TITLE}"`);
  const payload = { title: TEMPLATE_TITLE, categories: categoryIds, questions: questionIds };
  if (existing) {
    await pb.collection("game_templates").update(existing.id, payload);
    console.log(`~ template "${TEMPLATE_TITLE}" updated`);
  } else {
    await pb.collection("game_templates").create(payload);
    console.log(`+ template "${TEMPLATE_TITLE}"`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed:", err?.response?.message || err.message);
  if (err?.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
