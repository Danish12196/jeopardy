import type PocketBase from "pocketbase";
import type { Board } from "./boardFile";

/** Loads a saved template as a plain board (for export). */
export async function loadTemplateBoard(pb: PocketBase, templateId: string): Promise<Board> {
  const template = await pb.collection("game_templates").getOne(templateId);
  const categories = await Promise.all(
    (template.categories as string[]).map((id) => pb.collection("question_categories").getOne(id))
  );
  const ids = template.questions as string[];
  const questions = ids.length
    ? await pb.collection("questions").getFullList({
        filter: ids.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
      })
    : [];
  return {
    title: template.title,
    categories: categories.map((cat) => ({
      name: cat.name,
      questions: questions
        .filter((q) => q.category === cat.id)
        .sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0))
        .map((q, i) => ({
          value: q.value || (i + 1) * 100,
          question: q.question,
          answer: q.answer,
          ...(q.hint ? { hint: q.hint } : {}),
          ...(q.mediaUrl ? { mediaUrl: q.mediaUrl } : {}),
        })),
    })),
  };
}

/** Saves an imported board as new categories, questions and a template owned by the current user. */
export async function saveBoardAsTemplate(pb: PocketBase, board: Board, isPublic = false) {
  const user = pb.authStore.record?.id;
  if (!user) throw new Error("Log in to import a board.");
  const categoryIds: string[] = [];
  const questionIds: string[] = [];
  for (const cat of board.categories) {
    const record = await pb.collection("question_categories").create({ name: cat.name, isPublic, user });
    categoryIds.push(record.id);
    const created = await Promise.all(
      cat.questions.map((q, i) =>
        pb.collection("questions").create({
          question: q.question,
          answer: q.answer,
          hint: q.hint ?? "",
          mediaUrl: q.mediaUrl ?? "",
          value: q.value,
          difficulty: i + 1, // board order, lowest value first
          category: record.id,
          isPublic,
          user,
        })
      )
    );
    questionIds.push(...created.map((q) => q.id));
  }
  return pb.collection("game_templates").create({
    title: board.title,
    categories: categoryIds,
    questions: questionIds,
    isPublic,
    user,
  });
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
