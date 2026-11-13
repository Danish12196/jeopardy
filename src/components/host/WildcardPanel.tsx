import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clampWager, scoreOf, wildcardMaxWager, type TeamScore } from "@/lib/scoring";
import type { GameSettings, WildcardState } from "@/lib/pbTypes";

type Props = {
  wildcard: WildcardState;
  teams: { id: string; name: string }[];
  scores: TeamScore[];
  topValue: number;
  settings?: GameSettings;
  onLockIn: (team: string, wager: number) => void;
  onResult: (correct: boolean) => void;
};

/** Host controls for a Wildcard tile: pick the team, enter the wager, mark right or wrong. */
export default function WildcardPanel({ wildcard, teams, scores, topValue, settings, onLockIn, onResult }: Props) {
  const [team, setTeam] = useState(wildcard.team || "");
  const [wager, setWager] = useState("");
  const locked = wildcard.wager !== null && wildcard.wager !== undefined && !!wildcard.team;
  const max = team ? wildcardMaxWager(scoreOf(scores, team), topValue, settings) : 0;
  const teamName = (id?: string) => teams.find((t) => t.id === id)?.name ?? "";

  if (wildcard.resolved) {
    return <div className="z-10 mb-6 text-center font-semibold text-muted-foreground">Wildcard scored for {teamName(wildcard.team)}.</div>;
  }

  if (locked) {
    return (
      <div className="z-10 mb-6 flex flex-col gap-3">
        <p className="text-lg font-semibold">
          <span className="text-accent">{teamName(wildcard.team)}</span> wagered <span className="font-mono text-accent">{wildcard.wager}</span>
        </p>
        <div className="flex gap-3">
          <Button className="flex-1 h-12 bg-green-600 hover:bg-green-500 text-white font-bold" onClick={() => onResult(true)}>
            Right (+{wildcard.wager})
          </Button>
          <Button variant="destructive" className="flex-1 h-12 font-bold" onClick={() => onResult(false)}>
            Wrong (−{wildcard.wager})
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="z-10 mb-6 flex flex-col gap-3 bg-background/40 p-4 rounded-xl border border-accent/40">
      <p className="text-sm text-muted-foreground">Only the team that picked this tile plays. Buzzers stay locked.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Team playing the Wildcard">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeam(t.id)}
            aria-pressed={team === t.id}
            className={`px-4 py-2 rounded-lg font-bold border-2 transition-colors ${team === t.id ? "bg-accent border-accent text-accent-foreground" : "bg-secondary border-border/50"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex gap-3 items-center">
        <Input
          type="number"
          min={0}
          max={max}
          value={wager}
          onChange={(e) => setWager(e.target.value)}
          placeholder={team ? `Wager (0 to ${max})` : "Pick a team first"}
          aria-label="Wildcard wager"
          disabled={!team}
          className="bg-background h-12"
        />
        <Button
          variant="brand"
          className="h-12"
          disabled={!team || wager === ""}
          onClick={() => onLockIn(team, clampWager(Number(wager), max))}
        >
          Lock in wager
        </Button>
      </div>
      {team && <p className="text-xs text-muted-foreground">Max {max}: the team's score or the board's top value, whichever is higher.</p>}
    </div>
  );
}
