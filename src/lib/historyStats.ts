import type { GameHistoryRecord, GameHistoryStanding, GameTeam } from "./pbTypes";
import { scoreOf, type TeamScore } from "./scoring";

export interface TeamLeaderboardEntry {
  name: string;
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  avgScore: number;
}

export function buildStandings(teams: GameTeam[], scores: TeamScore[]): GameHistoryStanding[] {
  return teams
    .map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      color: t.color,
      score: scoreOf(scores, t.id),
    }))
    .sort((a, b) => b.score - a.score);
}

export function aggregateTeamStats(records: Pick<GameHistoryRecord, "standings" | "winnerName">[]): TeamLeaderboardEntry[] {
  const byTeam = new Map<string, { gamesPlayed: number; wins: number; totalScore: number; bestScore: number }>();

  for (const rec of records) {
    const standings = rec.standings ?? [];
    if (standings.length === 0) continue;
    const topScore = Math.max(...standings.map((s) => s.score));
    for (const s of standings) {
      const prev = byTeam.get(s.name) ?? { gamesPlayed: 0, wins: 0, totalScore: 0, bestScore: -Infinity };
      const isWinner = rec.winnerName ? s.name === rec.winnerName : s.score === topScore;
      byTeam.set(s.name, {
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + (isWinner ? 1 : 0),
        totalScore: prev.totalScore + s.score,
        bestScore: Math.max(prev.bestScore, s.score),
      });
    }
  }

  return Array.from(byTeam.entries())
    .map(([name, st]) => ({
      name,
      gamesPlayed: st.gamesPlayed,
      wins: st.wins,
      totalScore: st.totalScore,
      bestScore: st.bestScore === -Infinity ? 0 : st.bestScore,
      avgScore: Math.round(st.totalScore / st.gamesPlayed),
    }))
    .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);
}

function csvCell(value: string | number | undefined): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function historyToCsv(
  records: Pick<GameHistoryRecord, "gameCode" | "title" | "winnerName" | "winnerScore" | "finishedAt" | "standings">[]
): string {
  const header = ["Game Code", "Title", "Finished At", "Winner", "Winner Score", "Standings"].join(",");
  const rows = records.map((r) => {
    const standingsText = (r.standings ?? []).map((s) => `${s.name}: ${s.score}`).join(" | ");
    return [
      csvCell(r.gameCode),
      csvCell(r.title),
      csvCell(r.finishedAt),
      csvCell(r.winnerName),
      csvCell(r.winnerScore),
      csvCell(standingsText),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}
