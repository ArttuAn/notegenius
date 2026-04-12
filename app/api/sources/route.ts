import { NextRequest, NextResponse } from "next/server";
import { createSource } from "@/lib/db/queries/sources";
import { ingestSource } from "@/lib/ingestion";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const notebookId = formData.get("notebookId") as string;
  const type = formData.get("type") as "pdf" | "url" | "youtube" | "text";

  if (!notebookId || !type) {
    return NextResponse.json({ error: "notebookId and type required" }, { status: 400 });
  }

  let source;

  if (type === "pdf") {
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "File required" }, { status: 400 });
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const b64 = buffer.toString("base64");
    source = createSource(notebookId, "pdf", file.name, file.name);
    // Store base64 temporarily so ingest can access it
    db.prepare("UPDATE sources SET raw_text = ? WHERE id = ?").run(b64, source.id);
  } else if (type === "url") {
    const url = formData.get("url") as string;
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });
    source = createSource(notebookId, "url", url, url);
  } else if (type === "youtube") {
    const url = formData.get("url") as string;
    if (!url) return NextResponse.json({ error: "YouTube URL required" }, { status: 400 });
    source = createSource(notebookId, "youtube", `YouTube: ${url}`, url);
  } else if (type === "text") {
    const text = formData.get("text") as string;
    const title = (formData.get("title") as string) || "Text Document";
    if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });
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
}
