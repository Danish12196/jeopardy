import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAME_MODES } from "@/lib/gameModes";
import type { GameMode, TiebreakerState } from "@/lib/pbTypes";

type Props = {
  mode: GameMode;
  round: number;
  eliminatedNames: string[];
  canEliminate: boolean;
  topTied: boolean;
  tiebreaker: TiebreakerState | null | undefined;
  onNextRound: () => void;
  onEliminateLowest: () => void;
  onStartTiebreaker: (question: string, answer: string) => void;
  onRevealTiebreaker: () => void;
  onEndTiebreaker: () => void;
};

export default function HostModePanel({
  mode,
  round,
  eliminatedNames,
  canEliminate,
  topTied,
  tiebreaker,
  onNextRound,
  onEliminateLowest,
  onStartTiebreaker,
  onRevealTiebreaker,
  onEndTiebreaker,
}: Props) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const modeInfo = GAME_MODES.find((m) => m.value === mode);

  if (mode === "classic" && !topTied && !tiebreaker) return null;

  return (
    <div
      className="bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-accent/40 shadow-lg space-y-3"
      data-testid="host-mode-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm uppercase tracking-wider font-bold text-accent">
          {modeInfo?.label ?? "Mode"} {mode === "rounds" || mode === "elimination" ? `· Round ${round}` : ""}
        </h3>
        <div className="flex flex-wrap gap-2">
          {mode === "rounds" && round < 2 && (
            <Button size="sm" variant="brand" onClick={onNextRound}>
              Start Round 2 (2× values)
            </Button>
          )}
          {mode === "elimination" && (
            <>
              <Button size="sm" variant="destructive" disabled={!canEliminate} onClick={onEliminateLowest}>
                Eliminate Lowest Team
              </Button>
              <Button size="sm" variant="secondary" onClick={onNextRound}>
                Next Round
              </Button>
            </>
          )}
        </div>
      </div>

      {eliminatedNames.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="host-eliminated">
          Eliminated: {eliminatedNames.join(", ")}
        </p>
      )}

      {(topTied || tiebreaker) && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          {tiebreaker ? (
            <div className="space-y-2" data-testid="host-tiebreaker-active">
              <p className="text-sm font-semibold">Tiebreaker: {tiebreaker.question}</p>
              <p className="text-xs text-muted-foreground">Answer: {tiebreaker.answer}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onRevealTiebreaker} disabled={Boolean(tiebreaker.showAnswer)}>
                  Reveal Tiebreaker Answer
                </Button>
                <Button size="sm" variant="outline" onClick={onEndTiebreaker}>
                  End Tiebreaker
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!q.trim() || !a.trim()) return;
                onStartTiebreaker(q.trim(), a.trim());
                setQ("");
                setA("");
              }}
            >
              <p className="text-xs text-accent font-semibold">Top scores are tied. Ask a tiebreaker?</p>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tiebreaker question" aria-label="Tiebreaker Question" className="bg-background" />
              <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="Answer" aria-label="Tiebreaker Answer" className="bg-background" />
              <Button type="submit" size="sm" variant="brand">
                Start Tiebreaker
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
