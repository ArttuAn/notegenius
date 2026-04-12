import { NextRequest, NextResponse } from "next/server";
import { updateNote, deleteNote } from "@/lib/db/queries/notes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updated = updateNote(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteNote(id);
  return NextResponse.json({ ok: true });
}
