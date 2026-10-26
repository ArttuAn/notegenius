import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { listSessions, createSession } from "@/lib/db/queries/sessions";
import { requireNotebook } from "@/lib/notebook-input";
import { readJsonBody, optionalString, withRequestErrors } from "@/lib/request";

export async function GET(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  const sessions = listSessions(notebookId);
  return NextResponse.json(sessions);
}

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  const notebookId = requireNotebook(body.notebookId);
  const title = optionalString(body.title, "title", 500);
  const session = createSession(notebookId, title ?? "New Chat");
  return NextResponse.json(session, { status: 201 });
});
