import { describe, expect, it } from "vitest";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

describe("normalizeRoomCode", () => {
  it("uppercases and strips non-letters", () => {
    expect(normalizeRoomCode("ab c-d")).toBe("ABCD");
  });

  it("caps the code at four letters", () => {
    expect(normalizeRoomCode("abcdef")).toBe("ABCD");
  });

  it("drops digits and accented letters", () => {
    expect(normalizeRoomCode("a1é2b")).toBe("AB");
  });
});

describe("isValidRoomCode", () => {
  it.each(["ABCD", "ZZZZ"])("accepts %s", (code) => {
    expect(isValidRoomCode(code)).toBe(true);
  });

  it.each(["", "ABC", "ABCDE", "abcd", "AB1D"])("rejects %j", (code) => {
    expect(isValidRoomCode(code)).toBe(false);
  });
});
