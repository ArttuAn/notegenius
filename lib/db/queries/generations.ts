import { db } from "../index";
import type { Generation } from "../schema";
import { nanoid } from "nanoid";

export function listGenerations(notebookId: string): Generation[] {
  const rows = db
    .prepare("SELECT * FROM generations WHERE notebook_id = ? ORDER BY created_at DESC")
    .all(notebookId) as (Omit<Generation, "source_ids"> & { source_ids: string })[];
  return rows.map((r) => ({ ...r, source_ids: JSON.parse(r.source_ids || "[]") }));
}

export function createGeneration(
  notebookId: string,
  type: Generation["type"],
  title: string,
  content: string,
  sourceIds: string[] = []
): Generation {
  const id = `gen_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO generations (id, notebook_id, type, title, content, source_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, notebookId, type, title, content, JSON.stringify(sourceIds), now);
  return { id, notebook_id: notebookId, type, title, content, source_ids: sourceIds, created_at: now };
}

export function deleteGeneration(id: string): void {
  db.prepare("DELETE FROM generations WHERE id = ?").run(id);
}
