import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const response = authorizeRequest(request) ?? NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = { matcher: "/:path*" };
