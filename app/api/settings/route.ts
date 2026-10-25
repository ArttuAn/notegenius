import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/db/queries/settings";
import { validSetting } from "@/lib/settings";
import { readJsonBody, RequestError, withRequestErrors } from "@/lib/request";

export async function GET(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const settings = getSettings();
  return NextResponse.json(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])));
}

export const PATCH = withRequestErrors(async function PATCH(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const { key, value } = await readJsonBody(req);
  if (typeof key !== "string" || !validSetting(key, value, getSettings())) {
    throw new RequestError("Invalid setting: use a supported key and a value within its allowed range");
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(key, String(value), Date.now());
  return NextResponse.json({ ok: true });
});
