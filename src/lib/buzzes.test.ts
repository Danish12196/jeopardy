import { describe, expect, it } from "vitest";
import { buzzGap, buzzPosition, buzzTime, currentQueue, sortBuzzes, type Buzz } from "./buzzes";

const b = (id: string, team: string, created: string, round = 1): Buzz => ({ id, game: "g", team, round, created });

describe("buzz ordering", () => {
  it("parses PocketBase dates", () => {
    expect(buzzTime({ created: "2026-11-09 07:54:27.819Z" })).toBe(Date.UTC(2026, 10, 9, 7, 54, 27, 819));
  });

  it("sorts by server time, then id", () => {
    const list = [
      b("c", "t3", "2026-11-09 07:54:27.900Z"),
      b("b", "t2", "2026-11-09 07:54:27.819Z"),
      b("a", "t1", "2026-11-09 07:54:27.819Z"),
    ];
    expect(sortBuzzes(list).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("drops other rounds and duplicate teams", () => {
    const list = [
      b("x", "t1", "2026-11-09 07:54:27.100Z", 0),
      b("y", "t2", "2026-11-09 07:54:27.200Z"),
      b("z", "t2", "2026-11-09 07:54:27.300Z"),
      b("w", "t1", "2026-11-09 07:54:27.400Z"),
    ];
    const q = currentQueue(list, 1);
    expect(q.map((x) => x.id)).toEqual(["y", "w"]);
    expect(buzzPosition(q, "t1")).toBe(2);
    expect(buzzPosition(q, "t9")).toBe(0);
    expect(buzzGap(q, 1)).toBe("+0.20s");
    expect(buzzGap(q, 0)).toBe("");
  });
});
