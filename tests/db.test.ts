/**
 * The query layer against a real SQLite file.
 *
 * DATABASE_URL is set before anything imports lib/db, which is only possible
 * because the connection is opened on first use rather than at import time.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "notegenius-test-"));
  process.env.DATABASE_URL = path.join(dir, "test.db");
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function queries() {
  return {
    notebooks: await import("@/lib/db/queries/notebooks"),
    sources: await import("@/lib/db/queries/sources"),
    chunks: await import("@/lib/db/queries/chunks"),
  };
}

describe("notebooks", () => {
  it("round-trips through create, get and list", async () => {
    const { notebooks } = await queries();
    const made = notebooks.createNotebook("Research", "EU AI Act");
    expect(made.id).toMatch(/^nb_/);
    expect(notebooks.getNotebook(made.id)?.title).toBe("Research");
    expect(notebooks.listNotebooks().map((n) => n.id)).toContain(made.id);
  });

  it("returns null for an id that does not exist", async () => {
    const { notebooks } = await queries();
    expect(notebooks.getNotebook("nb_nope")).toBeNull();
  });

  it("updates only the fields it is given", async () => {
    const { notebooks } = await queries();
    const made = notebooks.createNotebook("Before", "keep me");
    const after = notebooks.updateNotebook(made.id, { title: "After" });
    expect(after?.title).toBe("After");
    expect(after?.description).toBe("keep me");
  });

  it("deletes its sources with it", async () => {
    const { notebooks, sources } = await queries();
    const made = notebooks.createNotebook("Doomed");
    const source = sources.createSource(made.id, "text", "note", "inline");
    notebooks.deleteNotebook(made.id);
    expect(sources.getSource(source.id)).toBeNull();
  });
});

describe("searchChunks", () => {
  it("finds a chunk by a word in it, scoped to its notebook", async () => {
    const { notebooks, sources, chunks } = await queries();
    const mine = notebooks.createNotebook("Mine");
    const other = notebooks.createNotebook("Other");
    const source = sources.createSource(mine.id, "text", "Doc", "inline");
    const elsewhere = sources.createSource(other.id, "text", "Doc", "inline");

    chunks.insertChunks([
      { sourceId: source.id, notebookId: mine.id, chunkIndex: 0,
        text: "the capybara is the largest living rodent", charStart: 0, charEnd: 41 },
    ]);
    chunks.insertChunks([
      { sourceId: elsewhere.id, notebookId: other.id, chunkIndex: 0,
        text: "capybara appears here too", charStart: 0, charEnd: 25 },
    ]);

    const hits = chunks.searchChunks(mine.id, "capybara");
    expect(hits).toHaveLength(1);
    expect(hits[0].source_id).toBe(source.id);
    expect(hits[0].sourceTitle).toBe("Doc");
  });

  it("returns nothing for a blank query instead of everything", async () => {
    const { notebooks, chunks } = await queries();
    const made = notebooks.createNotebook("Empty query");
    expect(chunks.searchChunks(made.id, "   ")).toEqual([]);
  });

  it("survives FTS punctuation instead of throwing a syntax error", async () => {
    const { notebooks, sources, chunks } = await queries();
    const made = notebooks.createNotebook("Punctuation");
    const source = sources.createSource(made.id, "text", "Doc", "inline");
    chunks.insertChunks([
      { sourceId: source.id, notebookId: made.id, chunkIndex: 0,
        text: "quoted material lives here", charStart: 0, charEnd: 26 },
    ]);
    expect(() => chunks.searchChunks(made.id, '"quoted" (material)*')).not.toThrow();
    expect(chunks.searchChunks(made.id, '"quoted" (material)*').length).toBeGreaterThan(0);
  });

  it("honours topK", async () => {
    const { notebooks, sources, chunks } = await queries();
    const made = notebooks.createNotebook("Many");
    const source = sources.createSource(made.id, "text", "Doc", "inline");
    chunks.insertChunks(
      Array.from({ length: 12 }, (_, i) => ({
        sourceId: source.id, notebookId: made.id, chunkIndex: i,
        text: `paragraph ${i} mentions otters`, charStart: i * 10, charEnd: i * 10 + 10,
      })),
    );
    expect(chunks.searchChunks(made.id, "otters", 3)).toHaveLength(3);
  });

  it("filters to the requested sources", async () => {
    const { notebooks, sources, chunks } = await queries();
    const made = notebooks.createNotebook("Filtered");
    const wanted = sources.createSource(made.id, "text", "Wanted", "inline");
    const ignored = sources.createSource(made.id, "text", "Ignored", "inline");
    for (const s of [wanted, ignored]) {
      chunks.insertChunks([
        { sourceId: s.id, notebookId: made.id, chunkIndex: 0,
          text: "pangolins are scaly", charStart: 0, charEnd: 19 },
      ]);
    }
    const hits = chunks.searchChunks(made.id, "pangolins", 8, [wanted.id]);
    expect(hits).toHaveLength(1);
    expect(hits[0].source_id).toBe(wanted.id);
  });

  it("keeps chunks in order for a source", async () => {
    const { notebooks, sources, chunks } = await queries();
    const made = notebooks.createNotebook("Ordered");
    const source = sources.createSource(made.id, "text", "Doc", "inline");
    chunks.insertChunks(
      [2, 0, 1].map((i) => ({
        sourceId: source.id, notebookId: made.id, chunkIndex: i,
        text: `part ${i}`, charStart: i, charEnd: i + 1,
      })),
    );
    expect(chunks.getChunksBySource(source.id).map((c) => c.chunk_index)).toEqual([0, 1, 2]);
  });
});
