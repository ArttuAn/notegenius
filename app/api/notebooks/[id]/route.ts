import { NextRequest, NextResponse } from "next/server";
import {
  getNotebook,
  updateNotebook,
  deleteNotebook,
} from "@/lib/db/queries/notebooks";
import { listSources } from "@/lib/db/queries/sources";
import { listGenerations } from "@/lib/db/queries/generations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const notebook = getNotebook(id);
  if (!notebook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sources = listSources(id);
  const generations = listGenerations(id);
  return NextResponse.json({ ...notebook, sources, generations });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updated = updateNotebook(id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}
