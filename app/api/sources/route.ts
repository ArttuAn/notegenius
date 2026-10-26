import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { createSource } from "@/lib/db/queries/sources";
import { ingestSource } from "@/lib/ingestion";
import { db } from "@/lib/db";
import { requireNotebook } from "@/lib/notebook-input";
import { readSourceForm, requiredString, RequestError, withRequestErrors } from "@/lib/request";
import { validatePublicUrl } from "@/lib/ingestion/public-http";
import { youtubeVideoId } from "@/lib/ingestion/youtube-url";

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const formData = await readSourceForm(req);
  const notebookId = requireNotebook(formData.get("notebookId"));
  const type = requiredString(formData.get("type"), "type");

  let source;

  if (type === "pdf") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new RequestError("A non-empty PDF file is required");
    if (file.size > 10 * 1024 * 1024) throw new RequestError("PDF exceeds 10 MiB", 413);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new RequestError("File is not a PDF");
    const b64 = buffer.toString("base64");
    source = createSource(notebookId, "pdf", file.name, file.name);
    // Store base64 temporarily so ingest can access it
    db.prepare("UPDATE sources SET raw_text = ? WHERE id = ?").run(b64, source.id);
  } else if (type === "url") {
    const url = requiredString(formData.get("url"), "url", 4096);
    try { validatePublicUrl(url); } catch { throw new RequestError("Invalid public HTTP(S) URL"); }
    source = createSource(notebookId, "url", url, url);
  } else if (type === "youtube") {
    const url = requiredString(formData.get("url"), "url", 4096);
    if (!youtubeVideoId(url)) throw new RequestError("Invalid YouTube URL");
    source = createSource(notebookId, "youtube", `YouTube: ${url}`, url);
  } else if (type === "text") {
    const text = requiredString(formData.get("text"), "text", 1024 * 1024);
    const title = requiredString(formData.get("title") || "Text Document", "title", 500);
    source = createSource(notebookId, "text", title, text);
  } else {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // Stream ingestion progress
  const sourceId = source.id;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );

      send({ status: "processing", sourceId });

      try {
        await ingestSource(sourceId);
        send({ status: "ready", sourceId });
      } catch (err) {
        send({ status: "error", sourceId, error: (err as Error).message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
