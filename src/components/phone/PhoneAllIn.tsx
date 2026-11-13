import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import pb from "@/pb";
import { allInMaxWager, clampWager, scoreOf, standings, type TeamScore } from "@/lib/scoring";
import type { GameRecord } from "@/lib/pbTypes";

const wagerKey = (gameId: string, teamId: string) => `lockout-wager-${gameId}-${teamId}`;

function savedWager(gameId: string, teamId: string): number | null {
  try {
    const v = localStorage.getItem(wagerKey(gameId, teamId));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

type Props = {
  game: GameRecord;
  teamId: string;
  teams: { id: string; name: string }[];
};

/** Phone screen for All In (wager entry) and the end of the game. */
export default function PhoneAllIn({ game, teamId, teams }: Props) {
  const scores: TeamScore[] = game.teamScores || [];
  const myScore = scoreOf(scores, teamId);
  const topValue = Math.max(0, ...(game.values ?? [0]));
  const max = allInMaxWager(myScore, game.settings, topValue);
  const [amount, setAmount] = useState("");
  const [locked, setLocked] = useState<number | null>(() => savedWager(game.id, teamId));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const wager = clampWager(Number(amount), max);
    setSending(true);
    setError(null);
    try {
      await pb.collection("wagers").create({ game: game.id, team: teamId, amount: wager });
      setLocked(wager);
      try { localStorage.setItem(wagerKey(game.id, teamId), String(wager)); } catch { /* storage unavailable */ }
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (err: any) {
      // A unique-index 400 means this team already locked one in (maybe from another phone).
      setError(game.allInPhase === "wager" ? "Your team's wager is already in, or wagers just closed." : "Wagers are closed.");
      console.warn("Wager not accepted:", err?.status);
    } finally {
      setSending(false);
    }
  };

  if (game.gameOver) {
    const ranked = standings(teams.map((t) => ({ ...t, score: scoreOf(scores, t.id) })));
    const place = ranked.findIndex((t) => t.id === teamId) + 1;
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4" data-testid="phone-game-over">
        <p className="text-4xl font-black uppercase tracking-widest text-accent">Game over</p>
        <p className="text-2xl font-bold">You finished #{place} with {myScore}</p>
        <p className="text-muted-foreground">Final standings are on the TV.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 w-full max-w-sm mx-auto">
      <p className="text-4xl font-black uppercase tracking-widest text-accent">All In</p>
      <p className="text-xl font-bold">{game.allIn?.category}</p>
      <p className="text-muted-foreground">Your score: <span className="font-mono text-foreground font-bold">{myScore}</span></p>

      {game.allInPhase === "wager" && locked === null && (
        <div className="w-full flex flex-col gap-3">
          <label htmlFor="allin-wager" className="font-semibold">Your wager (0 to {max})</label>
          <Input
            id="allin-wager"
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 text-center text-2xl font-mono bg-background"
          />
          <Button variant="brand" className="h-14 text-lg" disabled={amount === "" || sending} onClick={submit}>
            Lock in wager
          </Button>
          <p className="text-xs text-muted-foreground">Hidden from everyone until the reveal. You can't change it once it's in.</p>
        </div>
      )}

      {locked !== null && game.allInPhase === "wager" && (
        <p className="text-2xl font-bold text-green-400" data-testid="phone-wager-locked">Wager locked in: {locked}</p>
      )}
      {game.allInPhase !== "wager" && (
        <p className="text-xl text-muted-foreground">
          {locked !== null ? `You wagered ${locked}. ` : ""}Watch the TV.
        </p>
      )}
      {error && <p className="text-sm text-destructive font-bold">{error}</p>}
    </div>
  );
}
