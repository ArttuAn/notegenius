import type Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

export function migrate(db: Database.Database) {
  db.exec(SCHEMA_SQL);
  repairChunksFts(db);
}

/**
 * Rebuild chunks_fts if it still has the broken `chunk_id` column.
 *
 * The external-content table declared a column that source_chunks does not
 * have, so every search threw "no such column: T.chunk_id" and returned
 * nothing. CREATE VIRTUAL TABLE IF NOT EXISTS will not fix a database that
 * already has the old shape, and there is no index worth keeping — it is
 * rebuilt from source_chunks, which holds the text.
 */
function repairChunksFts(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(chunks_fts)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "chunk_id")) return;

  db.exec(`
    DROP TRIGGER IF EXISTS chunks_fts_insert;
    DROP TRIGGER IF EXISTS chunks_fts_delete;
    DROP TRIGGER IF EXISTS chunks_fts_update;
    DROP TABLE IF EXISTS chunks_fts;
  `);
  db.exec(SCHEMA_SQL);
  db.exec(`
    INSERT INTO chunks_fts(rowid, text, id, source_id, notebook_id)
    SELECT rowid, text, id, source_id, notebook_id FROM source_chunks;
  `);
}
