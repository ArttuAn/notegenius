import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { updateNote, deleteNote } from "@/lib/db/queries/notes";
import { readJsonBody, optionalString, RequestError, withRequestErrors } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withRequestErrors(async function PATCH(req: NextRequest, { params }: Params) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJsonBody(req);
  if (body.pinned !== undefined && body.pinned !== 0 && body.pinned !== 1) throw new RequestError("pinned must be 0 or 1");
  const updated = updateNote(id, {
    title: optionalString(body.title, "title", 500),
    content: optionalString(body.content, "content", 500000),
    pinned: body.pinned as 0 | 1 | undefined,
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
});

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = authorizeRequest(_req);
  if (denied) return denied;
  const { id } = await params;
  deleteNote(id);
  return NextResponse.json({ ok: true });
}
