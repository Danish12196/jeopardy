import { describe, expect, it } from "vitest";
import {
  activeTeamIds,
  isTopTied,
  lowestScoringTeam,
  normalizeGameMode,
  roundMultiplier,
  scaleQuestions,
} from "./gameModes";

describe("gameModes", () => {
  it("normalizes unknown modes to classic", () => {
    expect(normalizeGameMode("speed")).toBe("speed");
    expect(normalizeGameMode("bogus")).toBe("classic");
    expect(normalizeGameMode(undefined)).toBe("classic");
  });

  it("doubles values only in rounds mode round 2", () => {
    expect(roundMultiplier({ gameMode: "rounds" }, 1)).toBe(1);
    expect(roundMultiplier({ gameMode: "rounds" }, 2)).toBe(2);
    expect(roundMultiplier({ gameMode: "classic" }, 2)).toBe(1);
    expect(roundMultiplier(undefined, undefined)).toBe(1);
  });

  it("scales question values", () => {
    const qs = [[{ id: "a", question: "q", answer: "a", value: 100 }]];
    expect(scaleQuestions(qs, 2)[0][0].value).toBe(200);
    expect(scaleQuestions(qs, 1)).toBe(qs);
  });

  it("finds the lowest active team and skips eliminated ones", () => {
    const scores = [
      { id: "a", score: 300 },
      { id: "b", score: 100 },
      { id: "c", score: 200 },
    ];
    expect(lowestScoringTeam(["a", "b", "c"], scores, [])).toBe("b");
    expect(lowestScoringTeam(["a", "b", "c"], scores, ["b"])).toBe("c");
    expect(lowestScoringTeam(["a", "b", "c"], scores, ["b", "c"])).toBeNull();
    expect(activeTeamIds(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("detects a tied top score", () => {
    expect(isTopTied(["a", "b"], [{ id: "a", score: 200 }, { id: "b", score: 200 }])).toBe(true);
    expect(isTopTied(["a", "b"], [{ id: "a", score: 300 }, { id: "b", score: 200 }])).toBe(false);
    expect(isTopTied(["a"], [])).toBe(false);
  });
});
