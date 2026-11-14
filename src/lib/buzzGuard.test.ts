import { describe, expect, it } from "vitest";
import { createBuzzGuard } from "./buzzGuard";

describe("createBuzzGuard", () => {
  it("allows up to the limit then blocks until the window passes", () => {
    let t = 0;
    const guard = createBuzzGuard(3, 2000, () => t);
    expect(guard.attempt()).toBe(true);
    t = 100;
    expect(guard.attempt()).toBe(true);
    t = 200;
    expect(guard.attempt()).toBe(true);
    t = 300;
    expect(guard.attempt()).toBe(false);
    expect(guard.retryInMs()).toBe(1700);
    t = 2001;
    expect(guard.retryInMs()).toBe(0);
    expect(guard.attempt()).toBe(true);
  });
});
