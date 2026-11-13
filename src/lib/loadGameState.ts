import type PocketBase from "pocketbase";
import type {
  BoardQuestion,
  GameRecord,
  GameTeam,
  GameTemplateRecord,
  QuestionCategoryRecord,
  QuestionRecord,
  TeamRecord,
} from "./pbTypes";
import { normalizeSettings, scoreOf } from "./scoring";

export type LoadedGameState =
  | { notFound: true }
  | {
      notFound: false;
      game: GameRecord;
      categories: string[];
      questions: BoardQuestion[][];
      teams: GameTeam[];
    };

export function buildBoardFromRecords(
  categoryRecords: QuestionCategoryRecord[],
  allQuestions: QuestionRecord[],
  settings?: GameRecord["settings"]
): { categories: string[]; questions: BoardQuestion[][] } {
  const s = normalizeSettings(settings);
  const categories = categoryRecords.map((c) => c.name);
  const questions = categoryRecords.map((cat) =>
    allQuestions
      .filter((q) => q.category === cat.id)
      .sort((a, b) => (a.difficulty ?? 0) - (b.difficulty ?? 0))
      .map((q, i) => {
        const base = s.customValues[i] ?? (Number(q.value) > 0 ? Number(q.value) : (i + 1) * 100);
        return {
          id: q.id,
          question: q.question,
          answer: q.answer,
          value: Math.round(base * s.pointMultiplier),
        };
      })
  );
  return { categories, questions };
}

export function findQuestionPosition(
  grouped: BoardQuestion[][],
  questionId: string
): { row: number; col: number; value: number; questionData: BoardQuestion } | null {
  for (let col = 0; col < grouped.length; col++) {
    const row = grouped[col].findIndex((q) => q.id === questionId);
    if (row !== -1) {
      const questionData = grouped[col][row];
      return { row, col, value: questionData.value, questionData };
    }
  }
  return null;
}

function orderByIds<T extends { id: string }>(ids: string[], records: T[]): T[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => Boolean(r));
}

export async function loadGameState(
  pb: PocketBase,
  uniqueID: string | undefined
): Promise<LoadedGameState> {
  if (!uniqueID) return { notFound: true };

  const gameList = await pb.collection("games").getFullList<GameRecord>({
    filter: pb.filter("uniqueID = {:uniqueID}", { uniqueID }),
    expand: "template,teams",
  });
  if (gameList.length === 0) return { notFound: true };

  const game = gameList[0];
  const template =
    game.expand?.template ??
    (await pb.collection("game_templates").getOne<GameTemplateRecord>(game.template));

  const categoryIds = template.categories ?? [];
  const questionIds = template.questions ?? [];
  const teamIds = game.teams ?? [];

  const [fetchedCategories, allQuestions, fetchedTeams] = await Promise.all([
    categoryIds.length > 0
      ? pb.collection("question_categories").getFullList<QuestionCategoryRecord>({
          filter: categoryIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
        })
      : Promise.resolve([] as QuestionCategoryRecord[]),
    questionIds.length > 0
      ? pb.collection("questions").getFullList<QuestionRecord>({
          filter: questionIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
        })
      : Promise.resolve([] as QuestionRecord[]),
    game.expand?.teams
      ? Promise.resolve(game.expand.teams)
      : teamIds.length > 0
      ? pb.collection("teams").getFullList<TeamRecord>({
          filter: teamIds.map((id) => pb.filter("id = {:id}", { id })).join(" || "),
        })
      : Promise.resolve([] as TeamRecord[]),
  ]);

  const categoryRecords = orderByIds(categoryIds, fetchedCategories);
  const teamRecords = orderByIds(teamIds, fetchedTeams);

  const { categories, questions } = buildBoardFromRecords(categoryRecords, allQuestions, game.settings);
  const teams: GameTeam[] = teamRecords.map((t) => ({
    id: t.id,
    name: t.name,
    score: scoreOf(game.teamScores, t.id),
  }));

  return {
    notFound: false,
    game,
    categories,
    questions,
    teams,
  };
}
