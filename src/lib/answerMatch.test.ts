import { describe, expect, it } from "vitest";
import { closestEstimationWinners, isTypedMatch, normalizeAnswer } from "./answerMatch";

describe("answerMatch", () => {
  it("normalizes punctuation, case, and spacing", () => {
    expect(normalizeAnswer("  New   York! ")).toBe("new york");
  });

  it("matches typed answers with minor typos on longer words", () => {
    expect(isTypedMatch("Canbera", "Canberra")).toBe(true);
    expect(isTypedMatch("Paris", "London")).toBe(false);
    expect(isTypedMatch("cat", "car")).toBe(false);
  });

  it("picks closest estimation winners including ties", () => {
    expect(
      closestEstimationWinners(
        [
          { team: "t1", value: "90" },
          { team: "t2", value: "105" },
          { team: "t3", value: "bad" },
        ],
        100
      )
    ).toEqual(["t2"]);

    expect(
      closestEstimationWinners(
        [
          { team: "t1", value: "95" },
          { team: "t2", value: "105" },
        ],
        100
      )
    ).toEqual(["t1", "t2"]);
  });
});
