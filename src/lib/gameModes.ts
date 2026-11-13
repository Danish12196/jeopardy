import type { BoardQuestion, GameMode, GameSettings } from "./pbTypes";
import { scoreOf, type TeamScore } from "./scoring";

export const GAME_MODES: { value: GameMode; label: string; description: string }[] = [
  { value: "classic", label: "Classic", description: "Standard Lockout board." },
  { value: "rounds", label: "Rounds", description: "Round 2 doubles every tile value." },
  { value: "elimination", label: "Elimination", description: "Host eliminates the lowest-scoring team between rounds." },
  { value: "speed", label: "Speed Round", description: "Short buzz timer on every question." },
  { value: "solo", label: "Solo", description: "Single-screen play for one person." },
];

export const DEFAULT_SPEED_BUZZ_SECONDS = 5;

export function normalizeGameMode(mode: unknown): GameMode {
  return GAME_MODES.some((m) => m.value === mode) ? (mode as GameMode) : "classic";
}

/** Value multiplier for the current round. Only "rounds" mode changes it (round 2 = 2x). */
export function roundMultiplier(settings: GameSettings | null | undefined, round: number | null | undefined): number {
  if (normalizeGameMode(settings?.gameMode) !== "rounds") return 1;
  return (round ?? 1) >= 2 ? 2 : 1;
}

export function scaleQuestions(questions: BoardQuestion[][], factor: number): BoardQuestion[][] {
  if (factor === 1) return questions;
  return questions.map((col) => col.map((q) => ({ ...q, value: Math.round(q.value * factor) })));
}

/** Teams still in the game (not eliminated). */
export function activeTeamIds(teamIds: string[], eliminated: string[] | null | undefined): string[] {
  const out = new Set(eliminated ?? []);
  return teamIds.filter((id) => !out.has(id));
}

/** The active team with the lowest score; ties go to the first one listed. Null if fewer than 2 are left. */
export function lowestScoringTeam(
  teamIds: string[],
  scores: TeamScore[],
  eliminated: string[] | null | undefined
): string | null {
  const active = activeTeamIds(teamIds, eliminated);
  if (active.length < 2) return null;
  return active.reduce((low, id) => (scoreOf(scores, id) < scoreOf(scores, low) ? id : low), active[0]);
}

/** True when the top two scores are equal (a tiebreaker would decide the winner). */
export function isTopTied(teamIds: string[], scores: TeamScore[]): boolean {
  if (teamIds.length < 2) return false;
  const sorted = teamIds.map((id) => scoreOf(scores, id)).sort((a, b) => b - a);
  return sorted[0] === sorted[1];
}
