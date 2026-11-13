import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import TimerDisplay from "@/components/TimerDisplay";
import { buzzGap, type Buzz } from "@/lib/buzzes";
import type { GameTeam } from "@/lib/pbTypes";

type Props = {
  buzzerUnlocked: boolean;
  autoUnlock: boolean;
  onAutoUnlockChange: (checked: boolean) => void;
  onToggleBuzzer: (unlock: boolean) => void;
  onClearBuzzers: () => void;
  buzzQueue: Buzz[];
  teams: GameTeam[];
  timerEndsAt?: string;
  timerType?: "buzz" | "answer" | "";
  timerPausedRemaining?: number | null;
  answerTimerSeconds?: number;
  onStartTimer?: (type: "buzz" | "answer", seconds: number) => void;
  onPauseTimer?: () => void;
  onResumeTimer?: () => void;
  onClearTimer?: () => void;
};

export default function HostBuzzerControls({
  buzzerUnlocked,
  autoUnlock,
  onAutoUnlockChange,
  onToggleBuzzer,
  onClearBuzzers,
  buzzQueue,
  teams,
  timerEndsAt,
  timerType,
  timerPausedRemaining,
  answerTimerSeconds = 0,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onClearTimer,
}: Props) {
  const hasTimer = Boolean(timerEndsAt) || (typeof timerPausedRemaining === "number" && timerPausedRemaining > 0);
  const isPaused = typeof timerPausedRemaining === "number" && timerPausedRemaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-lg"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-accent">⚡</span> Buzzer Controls
        </h3>
        <label className="flex items-center gap-3 text-sm bg-background/50 px-4 py-2 rounded-lg cursor-pointer hover:bg-background/80 transition-colors border border-border/50">
          <input
            type="checkbox"
            checked={autoUnlock}
            onChange={(e) => onAutoUnlockChange(e.target.checked)}
            className="accent-accent w-4 h-4 cursor-pointer"
          />
          <span className="font-semibold">Auto-open on select</span>
        </label>
      </div>

      <div className="flex gap-4 mb-4">
        {buzzerUnlocked ? (
          <Button
            onClick={() => onToggleBuzzer(false)}
            variant="secondary"
            className="flex-1 h-14 text-lg font-bold border-2 border-accent/60 animate-pulse"
          >
            Lock buzzers
          </Button>
        ) : (
          <Button
            onClick={() => onToggleBuzzer(true)}
            variant="brand"
            className="flex-1 h-14 text-lg"
          >
            Open buzzers
          </Button>
        )}
        <Button
          onClick={onClearBuzzers}
          variant="secondary"
          className="flex-1 h-14 text-lg font-bold border-2 border-border/50"
        >
          Clear Queue
        </Button>
      </div>

      {onStartTimer && (
        <div className="flex flex-wrap items-center gap-2 mb-6 bg-background/40 p-3 rounded-xl border border-border/40">
          <TimerDisplay
            timerEndsAt={timerEndsAt}
            timerType={timerType}
            timerPausedRemaining={timerPausedRemaining}
          />
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onStartTimer("answer", answerTimerSeconds > 0 ? answerTimerSeconds : 15)}
            >
              Start Answer Timer ({answerTimerSeconds > 0 ? answerTimerSeconds : 15}s)
            </Button>
            {hasTimer && !isPaused && onPauseTimer && (
              <Button size="sm" variant="outline" onClick={onPauseTimer}>
                Pause Timer
              </Button>
            )}
            {isPaused && onResumeTimer && (
              <Button size="sm" variant="brand" onClick={onResumeTimer}>
                Resume Timer
              </Button>
            )}
            {hasTimer && onClearTimer && (
              <Button size="sm" variant="ghost" onClick={onClearTimer}>
                Clear Timer
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="bg-background/40 p-4 rounded-xl border border-border/40 shadow-inner min-h-[120px]">
        <h4 className="font-bold mb-3 text-muted-foreground uppercase text-xs tracking-wider">
          Buzz Queue (First to Last)
        </h4>
        {buzzQueue.length > 0 ? (
          <ol className="list-decimal list-inside space-y-2" data-testid="host-buzz-queue">
            <AnimatePresence>
              {buzzQueue.map((q, idx) => {
                const t = teams.find((team) => team.id === q.team);

                return (
                  <motion.li
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`text-lg p-2 rounded-lg ${
                      idx === 0
                        ? "bg-green-900/30 text-green-400 font-bold border border-green-500/30"
                        : "text-foreground/80"
                    }`}
                  >
                    {t?.name || q.team}{" "}
                    {idx > 0 && (
                      <span className="text-sm opacity-60 ml-2 font-mono">
                        ({buzzGap(buzzQueue, idx)})
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        ) : (
          <div className="flex items-center justify-center h-16 text-muted-foreground italic">
            No one has buzzed in yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
