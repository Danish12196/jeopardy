import { describe, expect, it } from "vitest";
import { brandingStyleVars, DEFAULT_BRANDING, normalizeBranding } from "./branding";

describe("branding", () => {
  it("normalizes branding with safe defaults and hex validation", () => {
    expect(normalizeBranding(undefined)).toEqual(DEFAULT_BRANDING);
    expect(normalizeBranding({ accentColor: "not-a-color", gameTitle: "  Trivia Night  " })).toEqual({
      ...DEFAULT_BRANDING,
      gameTitle: "Trivia Night",
    });
    expect(normalizeBranding({ accentColor: "#00AAFF", tvTheme: "light" }).accentColor).toBe("#00AAFF");
  });

  it("produces CSS variables for light theme and midnight background", () => {
    const light = brandingStyleVars({ tvTheme: "light", accentColor: "#2563EB" }) as Record<string, string>;
    expect(light["--accent"]).toBe("#2563EB");
    expect(light["--background"]).toBe("#F4F1EA");
    expect(light["--foreground"]).toBe("#1C1C1E");

    const midnight = brandingStyleVars({ backgroundStyle: "midnight" }) as Record<string, string>;
    expect(midnight["--background"]).toBe("#0B1020");
  });
});
