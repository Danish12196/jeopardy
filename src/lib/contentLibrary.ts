import type { QuestionRecord } from "./pbTypes";

export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function filterQuestions<
  T extends Pick<QuestionRecord, "question" | "answer" | "difficulty" | "tags">,
>(
  questions: T[],
  opts: { query?: string; difficulty?: string; tag?: string }
): T[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const diff = (opts.difficulty ?? "").trim();
  const tag = (opts.tag ?? "").trim().toLowerCase();

  return questions.filter((item) => {
    if (q) {
      const hay = `${item.question} ${item.answer}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (diff && diff !== "all") {
      if (String(item.difficulty ?? "") !== diff) return false;
    }
    if (tag) {
      const tags = (item.tags ?? []).map((t) => t.toLowerCase());
      if (!tags.some((t) => t.includes(tag))) return false;
    }
    return true;
  });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export interface OpenTdbItem {
  category: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export function openTdbToBoard(items: OpenTdbItem[]): {
  categories: {
    name: string;
    questions: {
      question: string;
      answer: string;
      difficulty: number;
      value: number;
      questionType: "multiple_choice";
      options: string[];
      tags: string[];
    }[];
  }[];
} {
  const byCat = new Map<
    string,
    {
      question: string;
      answer: string;
      difficulty: number;
      value: number;
      questionType: "multiple_choice";
      options: string[];
      tags: string[];
    }[]
  >();

  for (const item of items) {
    const catName = decodeHtmlEntities(item.category || "General");
    const list = byCat.get(catName) ?? [];
    const difficulty =
      item.difficulty === "hard" ? 3 : item.difficulty === "medium" ? 2 : 1;
    const answer = decodeHtmlEntities(item.correct_answer);
    const options = [answer, ...item.incorrect_answers.map(decodeHtmlEntities)].sort();
    list.push({
      question: decodeHtmlEntities(item.question),
      answer,
      difficulty,
      value: (list.length + 1) * 100,
      questionType: "multiple_choice",
      options,
      tags: ["opentdb", item.difficulty || "easy"],
    });
    byCat.set(catName, list);
  }

  return {
    categories: Array.from(byCat.entries()).map(([name, questions]) => ({
      name,
      questions,
    })),
  };
}
