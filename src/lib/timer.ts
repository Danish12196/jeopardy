export function makeTimerEndsAt(seconds: number, nowMs = Date.now()): string {
  const clamped = Math.max(0, Math.round(seconds));
  return new Date(nowMs + clamped * 1000).toISOString();
}

export function computeRemainingSeconds(
  timerEndsAt?: string | null,
  timerPausedRemaining?: number | null,
  nowMs = Date.now()
): number | null {
  if (typeof timerPausedRemaining === "number" && timerPausedRemaining > 0) {
    return Math.ceil(timerPausedRemaining);
  }
  if (!timerEndsAt) return null;
  const endMs = Date.parse(timerEndsAt);
  if (!Number.isFinite(endMs)) return null;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
