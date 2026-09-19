import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/ingestion/chunker";

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("keeps a short document in one chunk", () => {
    const chunks = chunkText("A short note.", 1200, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("A short note.");
    expect(chunks[0].index).toBe(0);
  });

  it("always makes progress, so a document cannot loop forever", () => {
    // The guard is `start = max(start + 1, end - overlap)`. An overlap wider
    // than the chunk would otherwise move `start` backwards.
    const chunks = chunkText("x".repeat(5_000), 100, 500);
    expect(chunks.length).toBeGreaterThan(0);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].charStart).toBeGreaterThan(chunks[i - 1].charStart);
    }
  });

  it("numbers chunks consecutively from zero", () => {
    const chunks = chunkText("sentence. ".repeat(600), 1200, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it("prefers a paragraph break over cutting mid-sentence", () => {
    const head = "a".repeat(900);
    const tail = "b".repeat(900);
    const [first] = chunkText(`${head}\n\n${tail}`, 1200, 200);
    expect(first.text).toBe(head);
  });

  it("covers the whole document", () => {
    const text = "Sentence one. Sentence two. ".repeat(200);
    const chunks = chunkText(text, 300, 50);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks.at(-1)!.charEnd).toBe(text.length);
  });

  it("overlaps consecutive chunks so a sentence is never split away", () => {
    const chunks = chunkText("word ".repeat(2_000), 1000, 200);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[1].charStart).toBeLessThan(chunks[0].charEnd);
  });

  it("stops at the end instead of emitting a tail chunk per overlap character", () => {
    // Regression: the loop advanced `start` by one while `end` stayed pinned
    // at text.length, so every document ended with `overlap` near-duplicate
    // chunks — 200 by default. A 100k document produced 299 chunks instead
    // of ~99, and the duplicates crowded real passages out of search.
    const text = "word ".repeat(20_000);
    const chunks = chunkText(text, 1200, 200);
    const endingAtEof = chunks.filter((c) => c.charEnd === text.length);
    expect(endingAtEof).toHaveLength(1);
    expect(chunks.length).toBeLessThan(120);
  });

  it("never emits a blank chunk", () => {
    const chunks = chunkText(`${"a".repeat(1200)}\n\n\n\n${"b".repeat(1200)}`, 1200, 200);
    for (const chunk of chunks) expect(chunk.text.trim()).not.toBe("");
  });
});
