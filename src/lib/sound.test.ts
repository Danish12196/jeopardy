import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOUND_SETTINGS,
  normalizeSoundSettings,
  playSound,
} from "./sound";

describe("sound settings", () => {
  it("normalizes defaults and clamps volume", () => {
    expect(normalizeSoundSettings(undefined)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(normalizeSoundSettings({ volume: 2.5, muted: true }).volume).toBe(1);
    expect(normalizeSoundSettings({ volume: -0.5 }).volume).toBe(0);
  });

  it("returns false when muted or event is disabled", () => {
    expect(playSound("buzz", { muted: true, volume: 1 })).toBe(false);
    expect(playSound("buzz", { volume: 0 })).toBe(false);
    expect(playSound("correct", { enabledEvents: { correct: false } })).toBe(false);
  });
});
