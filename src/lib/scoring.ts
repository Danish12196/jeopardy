// Score helpers shared by the host, TV and phones.

export type TeamScore = { id: string; score: number };

export function scoreOf(scores: TeamScore[] | undefined, teamId: string): number {
  return scores?.find((s) => s.id === teamId)?.score ?? 0;
}

/** Returns new scores with `delta` added to one team (adds the team if missing). */
export function applyDelta(scores: TeamScore[], teamId: string, delta: number): TeamScore[] {
  const has = scores.some((s) => s.id === teamId);
  const next = scores.map((s) => (s.id === teamId ? { ...s, score: s.score + delta } : s));
  return has ? next : [...next, { id: teamId, score: delta }];
}

/** Wildcard wager cap: the team's score or the board's top value, whichever is higher. */
export function wildcardMaxWager(score: number, topValue: number): number {
  return Math.max(score, topValue, 0);
}

/** All In wager cap: whatever the team has (nothing if at or below zero). */
export function allInMaxWager(score: number): number {
  return Math.max(score, 0);
}

export function clampWager(amount: number, max: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.min(Math.max(Math.round(amount), 0), max);
}

/** Highest score first; ties keep the given order. */
export function standings<T extends { score: number }>(teams: T[]): T[] {
  return [...teams].sort((a, b) => b.score - a.score);
}

/** All In reveal order: lowest score first, so the leader goes last. */
export function revealOrder(scores: TeamScore[], teamIds: string[]): string[] {
  return [...teamIds].sort((a, b) => scoreOf(scores, a) - scoreOf(scores, b));
}

/** Keeps the undo list short. */
export const MAX_UNDO = 20;
export function pushHistory(history: TeamScore[][] | undefined, prev: TeamScore[]): TeamScore[][] {
  return [...(history ?? []), prev].slice(-MAX_UNDO);
}
