import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PWA assets", () => {
  it("manifest has the fields needed to install", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(m.name).toBe("Lockout");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/game");
    expect(m.icons.length).toBeGreaterThan(0);
  });
  it("service worker never caches the API", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toContain('startsWith("/api/")');
    expect(sw).toContain("skipWaiting");
  });
});
