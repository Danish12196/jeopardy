// Score helpers shared by the host, TV and phones.
import type { GameSettings, WrongPenalty } from "./pbTypes";
import { DEFAULT_BRANDING, normalizeBranding } from "./branding";
import { DEFAULT_SOUND_SETTINGS, normalizeSoundSettings } from "./sound";

export type TeamScore = { id: string; score: number };

export const DEFAULT_GAME_SETTINGS: Required<GameSettings> = {
  wrongPenalty: "full",
  stealEnabled: false,
  pointMultiplier: 1,
  customValues: [],
  wildcardEnabled: true,
  wildcardCapMode: "standard",
  wildcardFixedCap: 1000,
  allInEnabled: true,
  allInCapMode: "score",
  buzzTimerSeconds: 0,
  answerTimerSeconds: 0,
  branding: DEFAULT_BRANDING,
  sound: DEFAULT_SOUND_SETTINGS,
};

export function normalizeSettings(settings?: GameSettings | null): Required<GameSettings> {
  const multiplier = Number(settings?.pointMultiplier);
  const fixedCap = Number(settings?.wildcardFixedCap);
  const buzzTimer = Number(settings?.buzzTimerSeconds);
  const answerTimer = Number(settings?.answerTimerSeconds);
  return {
    wrongPenalty: settings?.wrongPenalty ?? DEFAULT_GAME_SETTINGS.wrongPenalty,
    stealEnabled: settings?.stealEnabled ?? DEFAULT_GAME_SETTINGS.stealEnabled,
    pointMultiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
    customValues: Array.isArray(settings?.customValues)
      ? settings.customValues.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
      : [],
    wildcardEnabled: settings?.wildcardEnabled ?? DEFAULT_GAME_SETTINGS.wildcardEnabled,
    wildcardCapMode: settings?.wildcardCapMode ?? DEFAULT_GAME_SETTINGS.wildcardCapMode,
    wildcardFixedCap: Number.isFinite(fixedCap) && fixedCap >= 0 ? Math.round(fixedCap) : DEFAULT_GAME_SETTINGS.wildcardFixedCap,
    allInEnabled: settings?.allInEnabled ?? DEFAULT_GAME_SETTINGS.allInEnabled,
    allInCapMode: settings?.allInCapMode ?? DEFAULT_GAME_SETTINGS.allInCapMode,
    buzzTimerSeconds: Number.isFinite(buzzTimer) && buzzTimer >= 0 ? Math.round(buzzTimer) : 0,
    answerTimerSeconds: Number.isFinite(answerTimer) && answerTimer >= 0 ? Math.round(answerTimer) : 0,
    branding: normalizeBranding(settings?.branding),
    sound: normalizeSoundSettings(settings?.sound),
  };
}

export function wrongDelta(value: number, penalty: WrongPenalty = "full"): number {
  const abs = Math.abs(Math.round(value));
  if (penalty === "none") return 0;
  if (penalty === "half") return -Math.round(abs / 2);
  return -abs;
}

export function effectiveBoardValues(
  baseValues: number[] | undefined,
  rowCount: number,
  settings?: GameSettings | null
): number[] {
  const s = normalizeSettings(settings);
  const out: number[] = [];
  for (let i = 0; i < rowCount; i++) {
    const custom = s.customValues[i];
    const base = custom ?? baseValues?.[i] ?? (i + 1) * 100;
    out.push(Math.round(base * s.pointMultiplier));
  }
  return out;
}

export function scoreOf(scores: TeamScore[] | undefined, teamId: string): number {
  return scores?.find((s) => s.id === teamId)?.score ?? 0;
}

/** Returns new scores with `delta` added to one team (adds the team if missing). */
export function applyDelta(scores: TeamScore[], teamId: string, delta: number): TeamScore[] {
  const has = scores.some((s) => s.id === teamId);
  const next = scores.map((s) => (s.id === teamId ? { ...s, score: s.score + delta } : s));
  return has ? next : [...next, { id: teamId, score: delta }];
}

/** Wildcard wager cap: configurable via settings, defaults to max(score, topValue, 0). */
export function wildcardMaxWager(
  score: number,
  topValue: number,
  settings?: GameSettings | null
): number {
  const s = normalizeSettings(settings);
  if (s.wildcardCapMode === "unlimited") return 1_000_000;
  if (s.wildcardCapMode === "fixed") return Math.max(s.wildcardFixedCap, 0);
  return Math.max(score, topValue, 0);
}

/** All In wager cap: configurable via settings, defaults to max(score, 0). */
export function allInMaxWager(
  score: number,
  settings?: GameSettings | null,
  topValue = 0
): number {
  const s = normalizeSettings(settings);
  if (s.allInCapMode === "score_or_top") return Math.max(score, topValue, 0);
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

/**
 * One Undo step: the scores before a change, plus the Wildcard and All In
 * state at that moment. Entries saved before this existed are plain score
 * arrays, which still restore the scores.
 */
export type ScoreSnapshot = TeamScore[] | { teamScores: TeamScore[]; wildcard: unknown; allIn: unknown };

/** The game fields to write back for an Undo step. */
export function restoreSnapshot(snap: ScoreSnapshot): Record<string, unknown> {
  if (Array.isArray(snap)) return { teamScores: snap };
  return { teamScores: snap.teamScores, wildcard: snap.wildcard, allIn: snap.allIn };
}

/** Keeps the undo list short. */
export const MAX_UNDO = 20;
export function pushHistory(history: ScoreSnapshot[] | undefined, prev: ScoreSnapshot): ScoreSnapshot[] {
  return [...(history ?? []), prev].slice(-MAX_UNDO);
}
