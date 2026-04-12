import { NextRequest, NextResponse } from "next/server";
import { getSource, deleteSource } from "@/lib/db/queries/sources";
import { getChunksBySource } from "@/lib/db/queries/chunks";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const source = getSource(id);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const chunks = getChunksBySource(id);
  return NextResponse.json({ ...source, chunks });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteSource(id);
  return NextResponse.json({ ok: true });
}
