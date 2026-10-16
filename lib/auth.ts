import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizeRequest(request: Request): NextResponse | null {
  const password = process.env.NOTEGENIUS_PASSWORD ?? "";
  if (password.trim().length < 32) {
    return NextResponse.json({ error: "Configure NOTEGENIUS_PASSWORD before using the app" }, { status: 503 });
  }
  const url = new URL(request.url);
  const configuredOrigin = process.env.NOTEGENIUS_ORIGIN;
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((configuredOrigin && url.origin !== configuredOrigin) || (!configuredOrigin && !localHost)) {
    return NextResponse.json({ error: "Host is not allowed" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== url.origin) {
    return NextResponse.json({ error: "Origin is not allowed" }, { status: 403 });
  }
  let valid = false;
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(authorization)) {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const username = process.env.NOTEGENIUS_USERNAME ?? "admin";
      valid = separator >= 0 && equal(decoded.slice(0, separator), username) && equal(decoded.slice(separator + 1), password);
    }
  } catch { valid = false; }
  if (!valid) {
    return NextResponse.json({ error: "Authentication required" }, {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="NoteGenius", charset="UTF-8"', "Cache-Control": "no-store" },
    });
  }
  return null;
}
