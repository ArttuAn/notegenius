import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getNotebook,
  updateNotebook,
  deleteNotebook,
} from "@/lib/db/queries/notebooks";
import { listSources } from "@/lib/db/queries/sources";
import { listGenerations } from "@/lib/db/queries/generations";
import { readJsonBody, requiredString, optionalString, withRequestErrors } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const denied = authorizeRequest(_req);
  if (denied) return denied;
  const { id } = await params;
  const notebook = getNotebook(id);
  if (!notebook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sources = listSources(id);
  const generations = listGenerations(id);
  return NextResponse.json({ ...notebook, sources, generations });
}

export const PATCH = withRequestErrors(async function PATCH(req: NextRequest, { params }: Params) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJsonBody(req);
  const updated = updateNotebook(id, {
    title: body.title === undefined ? undefined : requiredString(body.title, "title", 500),
    description: optionalString(body.description, "description", 16000),
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
});

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = authorizeRequest(_req);
  if (denied) return denied;
  const { id } = await params;
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
