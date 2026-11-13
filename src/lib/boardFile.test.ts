import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardToCsv, boardToJson, parseBoardCsv, parseBoardFile, parseBoardJson, readCsv } from "./boardFile";

describe("readCsv", () => {
  it("handles quotes, commas, CRLF and blank lines", () => {
    expect(readCsv('a,"b, c","say ""hi"""\r\n\r\n1,2,"x\ny"\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "x\ny"],
    ]);
  });
});

describe("parseBoardCsv", () => {
  const header = "category,value,question,answer,hint\n";

  it("parses a board and sorts by value", () => {
    const { board, errors } = parseBoardCsv(header + "Sci,200,Q2,A2,\nSci,100,Q1,A1,H1\nArt,100,Q3,A3,\n", "Mine");
    expect(errors).toEqual([]);
    expect(board).toEqual({
      title: "Mine",
      categories: [
        { name: "Sci", questions: [{ value: 100, question: "Q1", answer: "A1", hint: "H1" }, { value: 200, question: "Q2", answer: "A2" }] },
        { name: "Art", questions: [{ value: 100, question: "Q3", answer: "A3" }] },
      ],
    });
  });

  it("allows the hint column to be left out", () => {
    expect(parseBoardCsv("category,value,question,answer\nSci,100,Q,A\n").errors).toEqual([]);
  });

  it("reports a missing answer with its row", () => {
    const { errors } = parseBoardCsv(header + "Sci,100,Q1,A1,\nSci,200,Q2,,\n");
    expect(errors).toEqual([{ row: 3, message: "Row 3: missing answer." }]);
  });

  it("reports a duplicate value in a category", () => {
    const { errors } = parseBoardCsv(header + "Sci,100,Q1,A1,\nArt,100,Q2,A2,\nSci,100,Q3,A3,\n");
    expect(errors.map((e) => e.message)).toEqual(['Row 4: duplicate value 100 in "Sci" (also on row 2).']);
  });

  it("reports the wrong column count", () => {
    const { errors } = parseBoardCsv(header + "Sci,100,Q1,A1\nSci,200,Q2,A2,,extra\n");
    expect(errors.map((e) => e.message)).toEqual([
      "Row 2: expected 5 columns, found 4.",
      "Row 3: expected 5 columns, found 6.",
      "The board has no categories.",
    ]);
  });

  it("reports a bad header and a bad value", () => {
    expect(parseBoardCsv("cat,val\nx,y\n").errors[0].message).toMatch(/^Header must be/);
    expect(parseBoardCsv(header + "Sci,abc,Q,A,\n").errors[0].message).toBe("Row 2: value must be a positive number.");
  });
});

describe("parseBoardJson", () => {
  it("parses and validates", () => {
    const ok = parseBoardJson('{"title":"T","categories":[{"name":"C","questions":[{"value":100,"question":"Q","answer":"A"}]}]}');
    expect(ok.errors).toEqual([]);
    expect(ok.board?.title).toBe("T");
    const bad = parseBoardJson('{"categories":[{"name":"C","questions":[{"value":100,"question":"Q"}]}]}');
    expect(bad.errors.map((e) => e.message)).toEqual(['"C" question 1: missing answer.']);
    expect(parseBoardJson("{nope").errors[0].message).toMatch(/^Not valid JSON/);
    expect(parseBoardJson("[]").errors[0].message).toMatch(/^JSON must look like/);
  });
});

describe("round trips and samples", () => {
  it("CSV and JSON exports parse back to the same board", () => {
    const { board } = parseBoardCsv('category,value,question,answer,hint\n"A, B",100,"He said ""hi""",yes,\nC,100,Q,A,H\n', "Round trip");
    expect(parseBoardCsv(boardToCsv(board!), "Round trip").board).toEqual(board);
    expect(parseBoardJson(boardToJson(board!)).board).toEqual(board);
  });

  it("the sample files are valid 6x5 boards with the same content", () => {
    const csv = parseBoardFile("board.csv", readFileSync("samples/board.csv", "utf8"));
    const json = parseBoardFile("board.json", readFileSync("samples/board.json", "utf8"));
    expect(csv.errors).toEqual([]);
    expect(json.errors).toEqual([]);
    expect(csv.board!.categories).toHaveLength(6);
    for (const c of csv.board!.categories) expect(c.questions.map((q) => q.value)).toEqual([100, 200, 300, 400, 500]);
    expect(json.board!.categories).toEqual(csv.board!.categories);
  });

  it("round-trips optional mediaUrl in CSV and JSON", () => {
    const csv = "category,value,question,answer,hint,mediaUrl\nMusic,100,Name this tune,Bohemian Rhapsody,,https://example.com/song.mp3\n";
    const parsed = parseBoardFile("music.csv", csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.board!.categories[0].questions[0].mediaUrl).toBe("https://example.com/song.mp3");
    const exported = boardToCsv(parsed.board!);
    expect(exported).toContain("mediaUrl");
    expect(exported).toContain("https://example.com/song.mp3");
  });
});
