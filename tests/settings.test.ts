import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, validSetting } from "../lib/settings";

describe("resource settings", () => {
  it("rejects unbounded retrieval and pathological chunk settings", () => {
    for (const value of [-1, 0, 33, 1.5, "8oops", "Infinity", {}, null]) {
      expect(validSetting("top_k", value, DEFAULT_SETTINGS), String(value)).toBe(false);
    }
    for (const value of [0, -1, 255, 4001, NaN, Infinity]) expect(validSetting("chunk_size", value, DEFAULT_SETTINGS)).toBe(false);
    for (const value of [-1, 601, 1200]) expect(validSetting("chunk_overlap", value, DEFAULT_SETTINGS)).toBe(false);
    expect(validSetting("unknown", "value", DEFAULT_SETTINGS)).toBe(false);
    expect(validSetting("theme", "<script>", DEFAULT_SETTINGS)).toBe(false);
  });
  it("accepts supported settings as numbers or stored numeric strings", () => {
    expect(validSetting("top_k", "32", DEFAULT_SETTINGS)).toBe(true);
    expect(validSetting("chunk_size", 2000, DEFAULT_SETTINGS)).toBe(true);
    expect(validSetting("chunk_overlap", 0, DEFAULT_SETTINGS)).toBe(true);
    expect(validSetting("theme", "dark", DEFAULT_SETTINGS)).toBe(true);
  });
  it("repairs unsafe values in existing databases when read", () => {
    expect(normalizeSettings({ top_k: "-1", chunk_size: "0", chunk_overlap: "999999", theme: "bad" })).toEqual(DEFAULT_SETTINGS);
    const small = normalizeSettings({ chunk_size: "256", chunk_overlap: "200", top_k: "8junk" });
    expect(small.chunk_size).toBe(256);
    expect(small.chunk_overlap).toBeLessThanOrEqual(128);
    expect(small.top_k).toBe(8);
  });
});
