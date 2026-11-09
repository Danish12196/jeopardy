import { describe, expect, it } from "vitest";
import { GAME_CODE_CHARS, makeGameCode } from "./gameCode";

describe("makeGameCode", () => {
  it("returns a code of the requested length", () => {
    expect(makeGameCode()).toHaveLength(6);
    expect(makeGameCode(8)).toHaveLength(8);
  });

  it("only uses unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      for (const ch of makeGameCode()) expect(GAME_CODE_CHARS).toContain(ch);
    }
    expect(GAME_CODE_CHARS).not.toMatch(/[01IO]/);
  });

  it("maps random bytes onto the alphabet", () => {
    const code = makeGameCode(3, () => new Uint8Array([0, 1, GAME_CODE_CHARS.length]));
    expect(code).toBe("ABA");
  });
});
