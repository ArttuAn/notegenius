import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { listNotes, createNote } from "@/lib/db/queries/notes";
import { requireNotebook } from "@/lib/notebook-input";
import { readJsonBody, optionalString, withRequestErrors } from "@/lib/request";

export async function GET(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  return NextResponse.json(listNotes(notebookId));
}

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  const notebookId = requireNotebook(body.notebookId);
  const title = optionalString(body.title, "title", 500);
  const content = optionalString(body.content, "content", 500000);
  const note = createNote(notebookId, title, content);
  return NextResponse.json(note, { status: 201 });
});
