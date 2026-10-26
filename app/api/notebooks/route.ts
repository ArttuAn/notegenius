import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { listNotebooks, createNotebook } from "@/lib/db/queries/notebooks";
import { createSession } from "@/lib/db/queries/sessions";
import { readJsonBody, requiredString, optionalString, withRequestErrors } from "@/lib/request";

export async function GET(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const notebooks = listNotebooks();
  return NextResponse.json(notebooks);
}

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  const title = requiredString(body.title, "title", 500);
  const description = optionalString(body.description, "description", 16000);
  const notebook = createNotebook(title, description);
  // Create a default chat session
  createSession(notebook.id, "Main Chat");
  return NextResponse.json(notebook, { status: 201 });
});
