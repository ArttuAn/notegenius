import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function PATCH(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(key, String(value), Date.now());
  return NextResponse.json({ ok: true });
}
