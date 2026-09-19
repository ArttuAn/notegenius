/**
 * The repair path for databases created before the chunks_fts column fix.
 */
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/db/migrate";

const BROKEN_FTS = `
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text, chunk_id UNINDEXED, source_id UNINDEXED, notebook_id UNINDEXED,
  content='source_chunks', content_rowid='rowid');
CREATE TRIGGER chunks_fts_insert AFTER INSERT ON source_chunks BEGIN
  INSERT INTO chunks_fts(rowid, text, chunk_id, source_id, notebook_id)
  VALUES (new.rowid, new.text, new.id, new.source_id, new.notebook_id);
END;
`;

let dir: string;
let db: Database.Database;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "notegenius-migrate-"));
  db = new Database(path.join(dir, "old.db"));
  // A database as it existed before the fix: correct tables, broken index.
  db.exec(`
    CREATE TABLE notebooks (id TEXT PRIMARY KEY, title TEXT, description TEXT,
      created_at INTEGER, updated_at INTEGER);
    CREATE TABLE sources (id TEXT PRIMARY KEY, notebook_id TEXT, type TEXT,
      title TEXT, origin TEXT, raw_text TEXT, char_count INTEGER, status TEXT,
      error_msg TEXT, created_at INTEGER);
    CREATE TABLE source_chunks (id TEXT PRIMARY KEY, source_id TEXT,
      notebook_id TEXT, chunk_index INTEGER, text TEXT, char_start INTEGER,
      char_end INTEGER, created_at INTEGER);
  ` + BROKEN_FTS);
  db.prepare("INSERT INTO notebooks VALUES ('nb_1','N',null,0,0)").run();
  db.prepare("INSERT INTO sources VALUES ('src_1','nb_1','text','Doc','inline',null,0,'ready',null,0)").run();
  db.prepare(
    "INSERT INTO source_chunks VALUES ('chk_1','src_1','nb_1',0,'the axolotl keeps its gills',0,27,0)",
  ).run();
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("migrate", () => {
  it("leaves the old database unable to search, before repair", () => {
    expect(() => db.prepare("SELECT COUNT(*) FROM chunks_fts").get()).toThrow(/chunk_id/);
  });

  it("rebuilds chunks_fts with a column source_chunks actually has", () => {
    migrate(db);
    const columns = (db.prepare("PRAGMA table_info(chunks_fts)").all() as { name: string }[])
      .map((c) => c.name);
    expect(columns).toContain("id");
    expect(columns).not.toContain("chunk_id");
  });

  it("reindexes rows that were already stored, so nothing has to be re-ingested", () => {
    migrate(db);
    const hits = db
      .prepare(
        `SELECT sc.id, bm25(chunks_fts) AS score FROM chunks_fts
         JOIN source_chunks sc ON chunks_fts.id = sc.id
         WHERE chunks_fts MATCH 'axolotl' AND chunks_fts.notebook_id = ?`,
      )
      .all("nb_1") as { id: string }[];
    expect(hits.map((h) => h.id)).toEqual(["chk_1"]);
  });

  it("is safe to run twice", () => {
    migrate(db);
    migrate(db);
    expect((db.prepare("SELECT COUNT(*) AS c FROM chunks_fts").get() as { c: number }).c).toBe(1);
  });
});
