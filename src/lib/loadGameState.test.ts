import { describe, expect, it, vi } from "vitest";
import type PocketBase from "pocketbase";
import { buildBoardFromRecords, findQuestionPosition, loadGameState } from "./loadGameState";
import type { QuestionCategoryRecord, QuestionRecord } from "./pbTypes";

const cat = (id: string, name: string): QuestionCategoryRecord =>
  ({ id, name } as QuestionCategoryRecord);

const q = (id: string, category: string, difficulty: number, value?: number): QuestionRecord =>
  ({
    id,
    category,
    difficulty,
    value,
    question: `Q ${id}`,
    answer: `A ${id}`,
  } as QuestionRecord);

describe("buildBoardFromRecords", () => {
  it("groups questions by category, sorts by difficulty, and computes fallback values", () => {
    const categories = [cat("c1", "History"), cat("c2", "Science")];
    const questions = [
      q("q2", "c1", 2, 0),
      q("q1", "c1", 1, 150),
      q("q3", "c2", 1),
    ];

    const board = buildBoardFromRecords(categories, questions);
    expect(board.categories).toEqual(["History", "Science"]);
    expect(board.questions).toEqual([
      [
        { id: "q1", question: "Q q1", answer: "A q1", value: 150 },
        { id: "q2", question: "Q q2", answer: "A q2", value: 200 },
      ],
      [{ id: "q3", question: "Q q3", answer: "A q3", value: 100 }],
    ]);
  });
});

describe("findQuestionPosition", () => {
  it("finds row, col, and value for a question id", () => {
    const { questions } = buildBoardFromRecords(
      [cat("c1", "A"), cat("c2", "B")],
      [q("q1", "c1", 1, 100), q("q2", "c2", 1, 100), q("q3", "c2", 2, 200)]
    );

    expect(findQuestionPosition(questions, "q3")).toEqual({
      col: 1,
      row: 1,
      value: 200,
      questionData: { id: "q3", question: "Q q3", answer: "A q3", value: 200 },
    });
    expect(findQuestionPosition(questions, "missing")).toBeNull();
  });
});

describe("loadGameState", () => {
  it("returns notFound when uniqueID is missing or no game matches", async () => {
    const getFullList = vi.fn().mockResolvedValue([]);
    const pb = {
      filter: vi.fn((expr: string, params: Record<string, string>) => `${expr}:${JSON.stringify(params)}`),
      collection: vi.fn(() => ({ getFullList })),
    } as unknown as PocketBase;

    expect(await loadGameState(pb, undefined)).toEqual({ notFound: true });
    expect(await loadGameState(pb, "NOPE")).toEqual({ notFound: true });
    expect(getFullList).toHaveBeenCalledTimes(1);
  });

  it("uses expand.template and expand.teams and guards empty template.questions", async () => {
    const gamesGetFullList = vi.fn().mockResolvedValue([
      {
        id: "g1",
        uniqueID: "ABC12",
        template: "tpl1",
        teams: ["t2", "t1"],
        teamScores: [{ id: "t1", score: 300 }],
        expand: {
          template: { id: "tpl1", title: "Empty", categories: ["c1"], questions: [] },
          teams: [
            { id: "t1", name: "Alpha" },
            { id: "t2", name: "Beta" },
          ],
        },
      },
    ]);
    const catsGetFullList = vi.fn().mockResolvedValue([cat("c1", "General")]);
    const qsGetFullList = vi.fn();

    const pb = {
      filter: vi.fn((expr: string, params: Record<string, string>) => `${expr}:${JSON.stringify(params)}`),
      collection: vi.fn((name: string) => {
        if (name === "games") return { getFullList: gamesGetFullList };
        if (name === "question_categories") return { getFullList: catsGetFullList };
        if (name === "questions") return { getFullList: qsGetFullList };
        throw new Error(`Unexpected collection: ${name}`);
      }),
    } as unknown as PocketBase;

    const result = await loadGameState(pb, "ABC12");
    expect(result.notFound).toBe(false);
    if (!result.notFound) {
      expect(result.categories).toEqual(["General"]);
      expect(result.questions).toEqual([[]]);
      expect(result.teams).toEqual([
        { id: "t2", name: "Beta", score: 0 },
        { id: "t1", name: "Alpha", score: 300 },
      ]);
    }
    expect(qsGetFullList).not.toHaveBeenCalled();
  });
});
