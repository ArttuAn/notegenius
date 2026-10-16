import { describe, expect, it } from "vitest";
import { youtubeVideoId } from "../lib/ingestion/youtube-url";

describe("YouTube source identity", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://music.youtube.com/live/dQw4w9WgXcQ/",
  ])("accepts a complete ID on an exact supported host: %s", (url) => {
    expect(youtubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });
  it.each([
    "https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ",
    "https://attacker.example/youtube.com/embed/dQw4w9WgXcQ",
    "https://attacker.example/?v=dQw4w9WgXcQ",
    "https://youtube.com@attacker.example/watch?v=dQw4w9WgXcQ",
    "https://user:password@youtube.com/watch?v=dQw4w9WgXcQ",
    "http://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQextra",
    "https://youtube.com/watch?v=dQw4w9WgXcQextra",
    "https://youtube.com/watch?v=short",
    "not a URL",
  ])("rejects misleading or malformed source URLs: %s", (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });
});
