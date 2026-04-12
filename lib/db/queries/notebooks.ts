import { db } from "../index";
import type { Notebook } from "../schema";
import { nanoid } from "nanoid";

export function listNotebooks(): Notebook[] {
  return db
    .prepare("SELECT * FROM notebooks ORDER BY updated_at DESC")
    .all() as Notebook[];
}

export function getNotebook(id: string): Notebook | null {
  return (
    (db.prepare("SELECT * FROM notebooks WHERE id = ?").get(id) as Notebook) ??
    null
  );
}

export function createNotebook(
  title: string,
  description?: string
): Notebook {
  const id = `nb_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO notebooks (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, title, description ?? null, now, now);
  return getNotebook(id)!;
}

export function updateNotebook(
  id: string,
  fields: Partial<Pick<Notebook, "title" | "description">>
): Notebook | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.title !== undefined) { sets.push("title = ?"); vals.push(fields.title); }
  if (fields.description !== undefined) { sets.push("description = ?"); vals.push(fields.description); }
  if (!sets.length) return getNotebook(id);
  sets.push("updated_at = ?");
  vals.push(Date.now(), id);
  db.prepare(`UPDATE notebooks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getNotebook(id);
}

export function deleteNotebook(id: string): void {
  db.prepare("DELETE FROM notebooks WHERE id = ?").run(id);
}

export function touchNotebook(id: string): void {
  db.prepare("UPDATE notebooks SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}
