import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buzzPosition, type Buzz } from "@/lib/buzzes";
import { scoreOf, wrongDelta, type TeamScore } from "@/lib/scoring";
import type { GameTeam, WrongPenalty } from "@/lib/pbTypes";

type Props = {
  teams: GameTeam[];
  scores: TeamScore[];
  buzzQueue: Buzz[];
  canUndo: boolean;
  scorePending: boolean;
  selectedValue: number;
  wrongPenalty?: WrongPenalty;
  stealEnabled?: boolean;
  adjust: Record<string, string>;
  onAdjustChange: (teamId: string, value: string) => void;
  onApplyAdjust: (teamId: string) => void;
  onUpdateScore: (teamId: string, delta: number, isWrong?: boolean) => void;
  onUndo: () => void;
};

export default function HostTeamScores({
  teams,
  scores,
  buzzQueue,
  canUndo,
  scorePending,
  selectedValue,
  wrongPenalty = "full",
  stealEnabled = false,
  adjust,
  onAdjustChange,
  onApplyAdjust,
  onUpdateScore,
  onUndo,
}: Props) {
  const wrongPoints = wrongDelta(selectedValue, wrongPenalty);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-lg flex-1 overflow-y-auto custom-scrollbar"
    >
      <div className="flex justify-between items-center mb-6 gap-3">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-accent">🏆</span> Teams & Scoring
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo || scorePending}
        >
          Undo last score change
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {teams.map((team) => (
            <motion.div
              key={team.id}
              layout
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                buzzQueue[0]?.team === team.id
                  ? "border-green-500 bg-green-900/10 shadow-[0_0_20px_rgba(74,222,128,0.1)]"
                  : "border-border/40 bg-background/50"
              }`}
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-bold text-lg flex items-center gap-3 truncate">
                  <span className="truncate">{team.name}</span>
                  {buzzPosition(buzzQueue, team.id) > 0 && (
                    <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full whitespace-nowrap shadow-sm font-bold">
                      Buzz #{buzzPosition(buzzQueue, team.id)}
                    </span>
                  )}
                </div>
                <motion.div
                  key={scoreOf(scores, team.id)}
                  initial={{ scale: 1.2, color: "var(--accent)" }}
                  animate={{ scale: 1, color: "var(--accent)" }}
                  className="text-accent font-mono text-2xl font-bold mt-1"
                  data-testid={`host-score-${team.name}`}
                >
                  {scoreOf(scores, team.id)}
                </motion.div>
              </div>
              <div className="flex gap-3 shrink-0 items-center">
                <form
                  className="flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onApplyAdjust(team.id);
                  }}
                >
                  <Input
                    type="number"
                    step={1}
                    value={adjust[team.id] ?? ""}
                    onChange={(e) => onAdjustChange(team.id, e.target.value)}
                    placeholder="±pts"
                    aria-label={`Adjust ${team.name}'s score by`}
                    className="w-20 h-10 bg-background"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={scorePending}
                    className="h-10"
                    aria-label={`Apply adjustment to ${team.name}`}
                  >
                    Apply
                  </Button>
                </form>
                <motion.button
                  whileHover={!scorePending ? { scale: 1.1 } : {}}
                  whileTap={!scorePending ? { scale: 0.9 } : {}}
                  disabled={scorePending}
                  onClick={() => onUpdateScore(team.id, selectedValue)}
                  aria-label={`Correct: add points to ${team.name}`}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-14 h-14 rounded-full font-bold flex items-center justify-center shadow-lg text-2xl transition-colors"
                >
                  +
                </motion.button>
                <motion.button
                  whileHover={!scorePending ? { scale: 1.1 } : {}}
                  whileTap={!scorePending ? { scale: 0.9 } : {}}
                  disabled={scorePending}
                  onClick={() => onUpdateScore(team.id, wrongPoints, true)}
                  aria-label={`Wrong: take points from ${team.name}${stealEnabled && buzzQueue[0]?.team === team.id ? " and pass" : ""}`}
                  title={stealEnabled && buzzQueue[0]?.team === team.id ? `Wrong (${wrongPoints}) & pass to next` : `Wrong (${wrongPoints})`}
                  className="bg-destructive hover:bg-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed text-white w-14 h-14 rounded-full font-bold flex items-center justify-center shadow-lg text-2xl transition-colors"
                >
                  −
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
