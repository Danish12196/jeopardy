import { describe, expect, it } from "vitest";
import {
  allInMaxWager,
  applyDelta,
  clampWager,
  effectiveBoardValues,
  normalizeSettings,
  pushHistory,
  restoreSnapshot,
  revealOrder,
  scoreOf,
  standings,
  wildcardMaxWager,
  wrongDelta,
  MAX_UNDO,
  type ScoreSnapshot,
} from "./scoring";

describe("scoring", () => {
  const scores = [{ id: "a", score: 300 }, { id: "b", score: -100 }];

  it("applies deltas", () => {
    expect(applyDelta(scores, "a", 200)).toEqual([{ id: "a", score: 500 }, { id: "b", score: -100 }]);
    expect(applyDelta(scores, "c", 100)).toContainEqual({ id: "c", score: 100 });
    expect(scoreOf(scores, "b")).toBe(-100);
    expect(scoreOf(scores, "zzz")).toBe(0);
  });

  it("caps wildcard wagers at the higher of score and top value, or per settings", () => {
    expect(wildcardMaxWager(1200, 500)).toBe(1200);
    expect(wildcardMaxWager(200, 500)).toBe(500);
    expect(wildcardMaxWager(-300, 500)).toBe(500);
    expect(wildcardMaxWager(200, 500, { wildcardCapMode: "fixed", wildcardFixedCap: 750 })).toBe(750);
    expect(wildcardMaxWager(200, 500, { wildcardCapMode: "unlimited" })).toBe(1_000_000);
  });

  it("caps All In wagers at the team's score or top value per settings", () => {
    expect(allInMaxWager(800)).toBe(800);
    expect(allInMaxWager(-50)).toBe(0);
    expect(allInMaxWager(100, { allInCapMode: "score_or_top" }, 500)).toBe(500);
    expect(clampWager(900, 800)).toBe(800);
    expect(clampWager(-5, 800)).toBe(0);
    expect(clampWager(NaN, 800)).toBe(0);
    expect(clampWager(12.6, 800)).toBe(13);
  });

  it("computes wrong-answer penalties", () => {
    expect(wrongDelta(200, "full")).toBe(-200);
    expect(wrongDelta(200, "half")).toBe(-100);
    expect(wrongDelta(150, "half")).toBe(-75);
    expect(wrongDelta(200, "none")).toBe(0);
  });

  it("computes effective board values with custom values and multiplier", () => {
    expect(effectiveBoardValues([100, 200, 300], 3, undefined)).toEqual([100, 200, 300]);
    expect(effectiveBoardValues([100, 200, 300], 3, { pointMultiplier: 2 })).toEqual([200, 400, 600]);
    expect(
      effectiveBoardValues([100, 200, 300], 3, { customValues: [250, 500], pointMultiplier: 2 })
    ).toEqual([500, 1000, 600]);
  });

  it("normalizes settings with defaults", () => {
    const s = normalizeSettings(undefined);
    expect(s.wrongPenalty).toBe("full");
    expect(s.stealEnabled).toBe(false);
    expect(s.pointMultiplier).toBe(1);
    expect(s.wildcardEnabled).toBe(true);
    expect(s.allInEnabled).toBe(true);
  });

  it("orders standings and the reveal", () => {
    expect(standings([{ n: 1, score: 1 }, { n: 2, score: 5 }]).map((t) => t.n)).toEqual([2, 1]);
    expect(revealOrder(scores, ["a", "b"])).toEqual(["b", "a"]);
  });

  it("keeps a bounded undo history", () => {
    let h: ScoreSnapshot[] = [];
    for (let i = 0; i < MAX_UNDO + 5; i++) h = pushHistory(h, [{ id: "a", score: i }]);
    expect(h).toHaveLength(MAX_UNDO);
    expect(h.at(-1)).toEqual([{ id: "a", score: MAX_UNDO + 4 }]);
  });

  it("restores round state with the scores, and old score-only entries", () => {
    const s = [{ id: "a", score: 1 }];
    expect(restoreSnapshot(s)).toEqual({ teamScores: s });
    const w = { question: "q", team: "a", wager: 5, resolved: false };
    expect(restoreSnapshot({ teamScores: s, wildcard: w, allIn: null })).toEqual({ teamScores: s, wildcard: w, allIn: null });
  });
});
