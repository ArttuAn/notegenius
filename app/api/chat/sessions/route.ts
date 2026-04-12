import { NextRequest, NextResponse } from "next/server";
import { listSessions, createSession, listMessages } from "@/lib/db/queries/sessions";

export async function GET(req: NextRequest) {
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  const sessions = listSessions(notebookId);
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { notebookId, title } = await req.json();
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  const session = createSession(notebookId, title ?? "New Chat");
  return NextResponse.json(session, { status: 201 });
}
