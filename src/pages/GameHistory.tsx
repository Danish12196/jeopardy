import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import pb from "@/pb";
import { aggregateTeamStats, historyToCsv } from "@/lib/historyStats";
import type { GameHistoryRecord } from "@/lib/pbTypes";

export default function GameHistory() {
  const [records, setRecords] = useState<GameHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    pb.collection("game_history")
      .getFullList<GameHistoryRecord>({ sort: "-created" })
      .then((list) => {
        if (active) setRecords(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const leaderboard = useMemo(() => aggregateTeamStats(records), [records]);

  const exportCsv = () => {
    const csv = historyToCsv(records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lockout-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto p-4 md:p-8 text-foreground bg-background bg-animated-gradient space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-accent">Game History & Stats</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={records.length === 0}>
            Export CSV
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to Setup</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading history...</p>
      ) : records.length === 0 ? (
        <div className="bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 text-center text-muted-foreground">
          No finished games yet. End a game from the Host Dashboard to record results here.
        </div>
      ) : (
        <>
          <section className="bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-xl space-y-4" data-testid="history-leaderboard">
            <h2 className="text-xl font-bold text-foreground">Recurring Team Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="py-2 pr-4">Team</th>
                    <th className="py-2 pr-4">Wins</th>
                    <th className="py-2 pr-4">Games</th>
                    <th className="py-2 pr-4">Avg Score</th>
                    <th className="py-2 pr-4">Best</th>
                    <th className="py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.name} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 pr-4 font-bold">{entry.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-accent">{entry.wins}</td>
                      <td className="py-2.5 pr-4 font-mono">{entry.gamesPlayed}</td>
                      <td className="py-2.5 pr-4 font-mono">{entry.avgScore}</td>
                      <td className="py-2.5 pr-4 font-mono">{entry.bestScore}</td>
                      <td className="py-2.5 font-mono">{entry.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4" data-testid="history-games-list">
            <h2 className="text-xl font-bold text-foreground">Past Games ({records.length})</h2>
            <div className="grid gap-4">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-card/60 backdrop-blur-md p-5 rounded-2xl border border-border/50 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{rec.title}</span>
                      <span className="text-xs font-mono bg-background/70 px-2 py-0.5 rounded border border-border/40">
                        {rec.gameCode}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Winner: <span className="text-accent font-semibold">{rec.winnerName || "—"}</span> ({rec.winnerScore ?? 0} pts)
                      {rec.finishedAt ? ` • ${new Date(rec.finishedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(rec.standings ?? []).map((s, idx) => (
                      <span
                        key={`${s.id}-${idx}`}
                        className="text-xs bg-background/60 px-2.5 py-1 rounded-lg border border-border/40 font-semibold"
                      >
                        {idx + 1}. {s.emoji ? `${s.emoji} ` : ""}{s.name}: {s.score}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
