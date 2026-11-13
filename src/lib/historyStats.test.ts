import { describe, expect, it } from "vitest";
import { aggregateTeamStats, buildStandings, historyToCsv } from "./historyStats";

describe("historyStats", () => {
  it("builds sorted standings descending by score", () => {
    const standings = buildStandings(
      [
        { id: "t1", name: "Alpha", score: 0 },
        { id: "t2", name: "Beta", score: 0, emoji: "🔥" },
      ],
      [
        { id: "t1", score: 150 },
        { id: "t2", score: 400 },
      ]
    );
    expect(standings.map((s) => s.name)).toEqual(["Beta", "Alpha"]);
    expect(standings[0].emoji).toBe("🔥");
    expect(standings[0].score).toBe(400);
  });

  it("aggregates recurring team stats across games", () => {
    const stats = aggregateTeamStats([
      {
        winnerName: "Alpha",
        standings: [
          { id: "1", name: "Alpha", score: 500 },
          { id: "2", name: "Beta", score: 300 },
        ],
      },
      {
        winnerName: "Beta",
        standings: [
          { id: "1", name: "Alpha", score: 200 },
          { id: "2", name: "Beta", score: 600 },
        ],
      },
    ]);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual({
      name: "Beta",
      gamesPlayed: 2,
      wins: 1,
      totalScore: 900,
      bestScore: 600,
      avgScore: 450,
    });
  });

  it("exports history records to CSV", () => {
    const csv = historyToCsv([
      {
        gameCode: "ABC12",
        title: 'Quiz "Night"',
        finishedAt: "2026-01-01T00:00:00Z",
        winnerName: "Alpha",
        winnerScore: 500,
        standings: [
          { id: "1", name: "Alpha", score: 500 },
          { id: "2", name: "Beta", score: 200 },
        ],
      },
    ]);
    expect(csv).toContain('"Game Code"'.replace(/"/g, "")); // header is unquoted
    expect(csv).toContain('"ABC12","Quiz ""Night"""');
    expect(csv).toContain('"Alpha: 500 | Beta: 200"');
  });
});
