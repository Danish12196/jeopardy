import { useEffect, useState } from "react";
import { computeRemainingSeconds, formatTimer } from "@/lib/timer";

type Props = {
  timerEndsAt?: string | null;
  timerType?: "buzz" | "answer" | "" | null;
  timerPausedRemaining?: number | null;
  className?: string;
};

export default function TimerDisplay({
  timerEndsAt,
  timerType,
  timerPausedRemaining,
  className = "",
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isPaused = typeof timerPausedRemaining === "number" && timerPausedRemaining > 0;
  const remaining = computeRemainingSeconds(timerEndsAt, timerPausedRemaining, nowMs);

  useEffect(() => {
    if (!timerEndsAt || isPaused) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, [timerEndsAt, isPaused]);

  if (remaining === null) return null;

  const label = timerType === "answer" ? "Answer" : "Buzz";
  const urgent = remaining > 0 && remaining <= 5;
  const expired = remaining === 0;

  return (
    <div
      data-testid="game-timer"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-sm md:text-base border transition-colors ${
        expired
          ? "bg-destructive/20 border-destructive text-destructive"
          : isPaused
          ? "bg-muted border-border text-muted-foreground"
          : urgent
          ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
          : "bg-accent/15 border-accent/40 text-accent"
      } ${className}`}
    >
      <span className="uppercase tracking-wider text-xs opacity-80">{label}</span>
      <span>{expired ? "Time's up!" : formatTimer(remaining)}</span>
      {isPaused && <span className="text-xs uppercase opacity-75">(Paused)</span>}
    </div>
  );
}
