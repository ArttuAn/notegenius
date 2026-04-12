import { db } from "../index";
import type { Note } from "../schema";
import { nanoid } from "nanoid";

export function listNotes(notebookId: string): Note[] {
  return db
    .prepare("SELECT * FROM notes WHERE notebook_id = ? ORDER BY pinned DESC, updated_at DESC")
    .all(notebookId) as Note[];
}

export function getNote(id: string): Note | null {
  return (db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as Note) ?? null;
}

export function createNote(notebookId: string, title = "Untitled Note", content = ""): Note {
  const id = `note_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO notes (id, notebook_id, title, content, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
  ).run(id, notebookId, title, content, now, now);
  return getNote(id)!;
}

export function updateNote(
  id: string,
  fields: Partial<Pick<Note, "title" | "content" | "pinned">>
): Note | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.title !== undefined) { sets.push("title = ?"); vals.push(fields.title); }
  if (fields.content !== undefined) { sets.push("content = ?"); vals.push(fields.content); }
  if (fields.pinned !== undefined) { sets.push("pinned = ?"); vals.push(fields.pinned); }
  if (!sets.length) return getNote(id);
  sets.push("updated_at = ?");
  vals.push(Date.now(), id);
  db.prepare(`UPDATE notes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getNote(id);
}

export function deleteNote(id: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}
