import { NextRequest, NextResponse } from "next/server";
import { deleteSession, listMessages } from "@/lib/db/queries/sessions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const messages = listMessages(id);
  return NextResponse.json(messages);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteSession(id);
  return NextResponse.json({ ok: true });
}
