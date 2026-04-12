import { db } from "../index";
import type { ChatSession, ChatMessage, Citation } from "../schema";
import { nanoid } from "nanoid";

export function listSessions(notebookId: string): ChatSession[] {
  return db
    .prepare("SELECT * FROM chat_sessions WHERE notebook_id = ? ORDER BY created_at DESC")
    .all(notebookId) as ChatSession[];
}

export function getSession(id: string): ChatSession | null {
  return (db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id) as ChatSession) ?? null;
}

export function createSession(notebookId: string, title = "Chat"): ChatSession {
  const id = `ses_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO chat_sessions (id, notebook_id, title, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, notebookId, title, now);
  return getSession(id)!;
}

export function deleteSession(id: string): void {
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
}

export function listMessages(sessionId: string): ChatMessage[] {
  const rows = db
    .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as (Omit<ChatMessage, "citations"> & { citations: string })[];
  return rows.map((r) => ({ ...r, citations: JSON.parse(r.citations || "[]") }));
}

export function insertMessage(
  sessionId: string,
  notebookId: string,
  role: "user" | "assistant",
  content: string,
  citations: Citation[] = []
): ChatMessage {
  const id = `msg_${nanoid(8)}`;
  const now = Date.now();
  db.prepare(
    "INSERT INTO chat_messages (id, session_id, notebook_id, role, content, citations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, sessionId, notebookId, role, content, JSON.stringify(citations), now);
  return { id, session_id: sessionId, notebook_id: notebookId, role, content, citations, created_at: now };
}
