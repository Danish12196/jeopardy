import { describe, expect, it } from "vitest";
import { computeRemainingSeconds, formatTimer, makeTimerEndsAt } from "./timer";

describe("timer", () => {
  it("creates an ISO end timestamp in the future", () => {
    const now = 1_700_000_000_000;
    expect(makeTimerEndsAt(15, now)).toBe(new Date(now + 15_000).toISOString());
    expect(makeTimerEndsAt(-5, now)).toBe(new Date(now).toISOString());
  });

  it("computes remaining seconds from endsAt or pausedRemaining", () => {
    const now = 1_700_000_000_000;
    const endsAt = new Date(now + 12_400).toISOString();
    expect(computeRemainingSeconds(endsAt, null, now)).toBe(13);
    expect(computeRemainingSeconds(endsAt, null, now + 20_000)).toBe(0);
    expect(computeRemainingSeconds(endsAt, 7, now + 20_000)).toBe(7);
    expect(computeRemainingSeconds("", null, now)).toBeNull();
  });

  it("formats seconds as m:ss", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(5)).toBe("0:05");
    expect(formatTimer(65)).toBe("1:05");
  });
});
