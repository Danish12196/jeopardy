import { describe, expect, it } from "vitest";
import { resolveHostShortcut } from "./shortcuts";

describe("resolveHostShortcut", () => {
  it("resolves host actions and ignores inputs", () => {
    expect(resolveHostShortcut({ key: " ", hasActiveQuestion: false })).toBe("toggleBuzzer");
    expect(resolveHostShortcut({ key: "p", hasActiveQuestion: false })).toBe("togglePause");
    expect(resolveHostShortcut({ key: "?", hasActiveQuestion: false })).toBe("toggleHelp");
    expect(resolveHostShortcut({ key: "r", hasActiveQuestion: false })).toBeNull();
    expect(resolveHostShortcut({ key: "r", hasActiveQuestion: true })).toBe("revealAnswer");
    expect(resolveHostShortcut({ key: "d", hasActiveQuestion: true })).toBe("doneQuestion");
    expect(resolveHostShortcut({ key: " ", targetTag: "INPUT", hasActiveQuestion: true })).toBeNull();
  });
});
