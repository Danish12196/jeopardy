import { describe, expect, it } from "vitest";
import { filterQuestions, openTdbToBoard, parseTags } from "./contentLibrary";

describe("contentLibrary", () => {
  it("parses and deduplicates comma-separated tags", () => {
    expect(parseTags("science, Space, science, , physics ")).toEqual([
      "science",
      "Space",
      "physics",
    ]);
  });

  it("filters questions by query, difficulty, and tag", () => {
    const list = [
      { question: "Red planet?", answer: "Mars", difficulty: 1, tags: ["space", "astronomy"] },
      { question: "Capital of Japan?", answer: "Tokyo", difficulty: 2, tags: ["geography"] },
    ];
    expect(filterQuestions(list, { query: "mars" })).toHaveLength(1);
    expect(filterQuestions(list, { difficulty: "2" })).toHaveLength(1);
    expect(filterQuestions(list, { tag: "astro" })).toHaveLength(1);
    expect(filterQuestions(list, { query: "mars", difficulty: "2" })).toHaveLength(0);
  });

  it("converts Open Trivia DB items into board categories and MC questions", () => {
    const board = openTdbToBoard([
      {
        category: "Science &amp; Nature",
        difficulty: "medium",
        question: "What is H&apos;s atomic number?",
        correct_answer: "1",
        incorrect_answers: ["2", "3", "4"],
      },
    ]);
    expect(board.categories).toHaveLength(1);
    expect(board.categories[0].name).toBe("Science & Nature");
    expect(board.categories[0].questions[0].question).toBe("What is H's atomic number?");
    expect(board.categories[0].questions[0].difficulty).toBe(2);
    expect(board.categories[0].questions[0].options).toEqual(["1", "2", "3", "4"]);
  });
});
