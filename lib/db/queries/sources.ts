import { db } from "../index";
import type { Source } from "../schema";
import { nanoid } from "nanoid";

export function listSources(notebookId: string): Source[] {
  return db
    .prepare("SELECT * FROM sources WHERE notebook_id = ? ORDER BY created_at ASC")
    .all(notebookId) as Source[];
}

export function getSource(id: string): Source | null {
  return (db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as Source) ?? null;
}

export function createSource(
  notebookId: string,
  type: Source["type"],
  title: string,
  origin: string
): Source {
  const id = `src_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO sources (id, notebook_id, type, title, origin, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
  ).run(id, notebookId, type, title, origin, now);
  return getSource(id)!;
}

export function updateSourceStatus(
  id: string,
  status: Source["status"],
  extra?: { rawText?: string; charCount?: number; errorMsg?: string }
): void {
  if (extra?.rawText !== undefined) {
    db.prepare(
      "UPDATE sources SET status = ?, raw_text = ?, char_count = ? WHERE id = ?"
    ).run(status, extra.rawText, extra.charCount ?? extra.rawText.length, id);
  } else if (extra?.errorMsg !== undefined) {
    db.prepare("UPDATE sources SET status = ?, error_msg = ? WHERE id = ?").run(
      status,
      extra.errorMsg,
      id
    );
  } else {
    db.prepare("UPDATE sources SET status = ? WHERE id = ?").run(status, id);
  }
}

export function deleteSource(id: string): void {
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}
