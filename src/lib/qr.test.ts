import { describe, expect, it } from "vitest";
import { qrMatrix, qrPath } from "./qr";

describe("qr", () => {
  it("builds a square matrix with finder patterns", () => {
    const m = qrMatrix("https://example.com/game/ABCD");
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    // Top-left finder: dark 7x7 border, light ring, dark core.
    expect(m[0].slice(0, 7).every(Boolean)).toBe(true);
    expect(m[1][1]).toBe(false);
    expect(m[3][3]).toBe(true);
  });
  it("is deterministic and emits a path with margin", () => {
    const a = qrMatrix("hello");
    expect(qrMatrix("hello")).toEqual(a);
    const { size, d } = qrPath(a, 2);
    expect(size).toBe(a.length + 4);
    expect(d.startsWith("M2 2h1v1h-1z")).toBe(true);
  });
});
