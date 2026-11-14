import { describe, expect, it } from "vitest";
import { parseMembersInput, teamDisplayName } from "./teamUtils";

describe("teamUtils", () => {
  it("parses comma-separated member names", () => {
    expect(parseMembersInput(" Alice, Bob , , Charlie ")).toEqual(["Alice", "Bob", "Charlie"]);
    expect(parseMembersInput("   ")).toEqual([]);
  });

  it("formats display name with optional emoji", () => {
    expect(teamDisplayName({ name: "Rockets", emoji: "🚀" })).toBe("🚀 Rockets");
    expect(teamDisplayName({ name: "Rockets" })).toBe("Rockets");
  });
});
