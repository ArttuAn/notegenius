import { db } from "../index";
import type { SourceChunk } from "../schema";
import { nanoid } from "nanoid";

export type ChunkInput = {
  sourceId: string;
  notebookId: string;
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
};

export function insertChunks(chunks: ChunkInput[]): void {
  const stmt = db.prepare(
    "INSERT INTO source_chunks (id, source_id, notebook_id, chunk_index, text, char_start, char_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertAll = db.transaction((items: ChunkInput[]) => {
    for (const c of items) {
      stmt.run(
        `chk_${nanoid(8)}`,
        c.sourceId,
        c.notebookId,
        c.chunkIndex,
        c.text,
        c.charStart,
        c.charEnd,
        Date.now()
      );
    }
  });
  insertAll(chunks);
}

export function getChunk(id: string): SourceChunk | null {
  return (db.prepare("SELECT * FROM source_chunks WHERE id = ?").get(id) as SourceChunk) ?? null;
}

export function getChunksBySource(sourceId: string): SourceChunk[] {
  return db
    .prepare("SELECT * FROM source_chunks WHERE source_id = ? ORDER BY chunk_index ASC")
    .all(sourceId) as SourceChunk[];
}

export function searchChunks(
  notebookId: string,
  query: string,
  topK: number = 8,
  sourceIds?: string[]
): (SourceChunk & { score: number; sourceTitle: string })[] {
  if (!query.trim()) return [];

  // Sanitize FTS query
  const ftsQuery = query
    .replace(/['"*()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" OR ");

  if (!ftsQuery) return [];

  let sql = `
    SELECT sc.*, bm25(chunks_fts) AS score, s.title AS sourceTitle
    FROM chunks_fts
    JOIN source_chunks sc ON chunks_fts.chunk_id = sc.id
    JOIN sources s ON sc.source_id = s.id
    WHERE chunks_fts MATCH ?
      AND chunks_fts.notebook_id = ?
  `;
  const params: unknown[] = [ftsQuery, notebookId];

  if (sourceIds && sourceIds.length > 0) {
    sql += ` AND sc.source_id IN (${sourceIds.map(() => "?").join(",")})`;
    params.push(...sourceIds);
  }

  sql += ` ORDER BY score LIMIT ?`;
  params.push(topK);

  try {
    return db.prepare(sql).all(...params) as (SourceChunk & { score: number; sourceTitle: string })[];
  } catch {
    return [];
  }
}
