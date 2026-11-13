import { describe, expect, it } from "vitest";
import { a11yStyleVars, buildAnnouncement, loadA11yPrefs, normalizeA11y, saveA11yPrefs } from "./a11y";
import { normalizeLocale, translate } from "./i18n";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("i18n", () => {
  it("translates with placeholders and falls back to English", () => {
    expect(translate("es", "tv.round", { n: 2 })).toBe("Ronda 2");
    expect(translate("en", "tv.round", { n: 2 })).toBe("Round 2");
    expect(normalizeLocale("de")).toBe("en");
    expect(normalizeLocale("fr")).toBe("fr");
  });
});

describe("a11y prefs", () => {
  it("normalizes junk to defaults", () => {
    expect(normalizeA11y(null)).toEqual({ largeText: false, colorblind: false, locale: "en" });
    expect(normalizeA11y({ largeText: true, locale: "xx" })).toEqual({ largeText: true, colorblind: false, locale: "en" });
  });
  it("round-trips through storage", () => {
    const s = memoryStorage();
    saveA11yPrefs({ largeText: true, colorblind: true, locale: "es" }, s);
    expect(loadA11yPrefs(s)).toEqual({ largeText: true, colorblind: true, locale: "es" });
  });
  it("only overrides colors in colorblind mode", () => {
    expect(a11yStyleVars({ largeText: false, colorblind: false, locale: "en" })).toEqual({});
    expect(a11yStyleVars({ largeText: false, colorblind: true, locale: "en" })).toHaveProperty("--accent", "#56B4E9");
  });
});

describe("buildAnnouncement", () => {
  it("describes the open question and first buzz", () => {
    const text = buildAnnouncement({ locale: "en", question: "Q?", firstBuzzTeam: "Team 1" });
    expect(text).toBe("Question open: Q?. Team 1 buzzed in");
  });
  it("announces leader on the board and game over", () => {
    expect(buildAnnouncement({ locale: "en", leader: { name: "A", score: 300 } })).toBe("A is leading with 300 points");
    expect(buildAnnouncement({ locale: "es", gameOver: true })).toBe("Fin del juego");
  });
});
