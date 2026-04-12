import { NextRequest, NextResponse } from "next/server";
import { listNotes, createNote } from "@/lib/db/queries/notes";

export async function GET(req: NextRequest) {
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  return NextResponse.json(listNotes(notebookId));
}

export async function POST(req: NextRequest) {
  const { notebookId, title, content } = await req.json();
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  const note = createNote(notebookId, title, content);
  return NextResponse.json(note, { status: 201 });
}
