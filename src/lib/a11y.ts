import type { CSSProperties } from "react";
import { normalizeLocale, translate, type Locale } from "./i18n";

export interface A11yPrefs {
  largeText: boolean;
  colorblind: boolean;
  locale: Locale;
}

export const DEFAULT_A11Y: A11yPrefs = { largeText: false, colorblind: false, locale: "en" };

const STORAGE_KEY = "lockout-a11y";

export function normalizeA11y(raw: unknown): A11yPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<A11yPrefs>;
  return {
    largeText: r.largeText === true,
    colorblind: r.colorblind === true,
    locale: normalizeLocale(r.locale),
  };
}

export function loadA11yPrefs(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): A11yPrefs {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return normalizeA11y(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11yPrefs(
  prefs: A11yPrefs,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage
) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

/** Okabe-Ito colorblind-safe accent colors (blue / orange instead of orange / red). */
export function a11yStyleVars(prefs: A11yPrefs): CSSProperties {
  if (!prefs.colorblind) return {};
  const vars: Record<string, string> = {
    "--accent": "#56B4E9",
    "--primary": "#56B4E9",
    "--ring": "#56B4E9",
    "--lockout-orange": "#56B4E9",
    "--destructive": "#E69F00",
  };
  return vars as CSSProperties;
}

export interface AnnouncementInput {
  locale: Locale;
  gameOver?: boolean;
  paused?: boolean;
  question?: string | null;
  answer?: string | null;
  showAnswer?: boolean;
  firstBuzzTeam?: string | null;
  leader?: { name: string; score: number } | null;
}

/** Text for the TV's screen-reader live region. */
export function buildAnnouncement(i: AnnouncementInput): string {
  const parts: string[] = [];
  if (i.gameOver) return translate(i.locale, "live.gameOver");
  if (i.paused) parts.push(translate(i.locale, "live.paused"));
  if (i.question) parts.push(translate(i.locale, "live.questionOpen", { q: i.question }));
  if (i.firstBuzzTeam) parts.push(translate(i.locale, "live.buzzed", { team: i.firstBuzzTeam }));
  if (i.question && i.showAnswer && i.answer) parts.push(translate(i.locale, "live.answer", { a: i.answer }));
  if (!i.question && i.leader) {
    parts.push(translate(i.locale, "live.leader", { team: i.leader.name, score: i.leader.score }));
  }
  return parts.join(". ");
}
