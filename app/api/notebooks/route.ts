import { NextRequest, NextResponse } from "next/server";
import { listNotebooks, createNotebook } from "@/lib/db/queries/notebooks";
import { createSession } from "@/lib/db/queries/sessions";

export async function GET() {
  const notebooks = listNotebooks();
  return NextResponse.json(notebooks);
}

export async function POST(req: NextRequest) {
  const { title, description } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const notebook = createNotebook(title, description);
  // Create a default chat session
  createSession(notebook.id, "Main Chat");
  return NextResponse.json(notebook, { status: 201 });
}
