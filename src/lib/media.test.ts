import { describe, expect, it } from "vitest";
import { inferMediaKind, resolveQuestionMedia } from "./media";

describe("media", () => {
  it("infers media kind from extension or data URI, respecting explicit override", () => {
    expect(inferMediaKind("https://example.com/clip.mp3")).toBe("audio");
    expect(inferMediaKind("https://example.com/clip.mp4?token=1")).toBe("video");
    expect(inferMediaKind("https://example.com/pic.png")).toBe("image");
    expect(inferMediaKind("data:audio/wav;base64,AAA")).toBe("audio");
    expect(inferMediaKind("https://example.com/stream", "video")).toBe("video");
  });

  it("resolves external mediaUrl when no PocketBase file is attached", () => {
    expect(resolveQuestionMedia(null, { id: "1", mediaUrl: "https://example.com/song.ogg" })).toEqual({
      mediaUrl: "https://example.com/song.ogg",
      mediaType: "audio",
    });
    expect(resolveQuestionMedia(null, { id: "1", mediaUrl: "" })).toBeNull();
  });
});
