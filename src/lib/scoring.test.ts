import { describe, expect, it } from "vitest";
import { allInMaxWager, applyDelta, clampWager, pushHistory, revealOrder, scoreOf, standings, wildcardMaxWager, MAX_UNDO } from "./scoring";

describe("scoring", () => {
  const scores = [{ id: "a", score: 300 }, { id: "b", score: -100 }];

  it("applies deltas", () => {
    expect(applyDelta(scores, "a", 200)).toEqual([{ id: "a", score: 500 }, { id: "b", score: -100 }]);
    expect(applyDelta(scores, "c", 100)).toContainEqual({ id: "c", score: 100 });
    expect(scoreOf(scores, "b")).toBe(-100);
    expect(scoreOf(scores, "zzz")).toBe(0);
  });

  it("caps wildcard wagers at the higher of score and top value", () => {
    expect(wildcardMaxWager(1200, 500)).toBe(1200);
    expect(wildcardMaxWager(200, 500)).toBe(500);
    expect(wildcardMaxWager(-300, 500)).toBe(500);
  });

  it("caps All In wagers at the team's score", () => {
    expect(allInMaxWager(800)).toBe(800);
    expect(allInMaxWager(-50)).toBe(0);
    expect(clampWager(900, 800)).toBe(800);
    expect(clampWager(-5, 800)).toBe(0);
    expect(clampWager(NaN, 800)).toBe(0);
    expect(clampWager(12.6, 800)).toBe(13);
  });

  it("orders standings and the reveal", () => {
    expect(standings([{ n: 1, score: 1 }, { n: 2, score: 5 }]).map((t) => t.n)).toEqual([2, 1]);
    expect(revealOrder(scores, ["a", "b"])).toEqual(["b", "a"]);
  });

  it("keeps a bounded undo history", () => {
    let h: { id: string; score: number }[][] = [];
    for (let i = 0; i < MAX_UNDO + 5; i++) h = pushHistory(h, [{ id: "a", score: i }]);
    expect(h).toHaveLength(MAX_UNDO);
    expect(h.at(-1)).toEqual([{ id: "a", score: MAX_UNDO + 4 }]);
  });
});
