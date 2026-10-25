import { authorizeRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { streamGenerate } from "@/lib/ai/generate";
import { createGeneration, listGenerations, deleteGeneration } from "@/lib/db/queries/generations";
import type { Generation } from "@/lib/db/schema";
import { requireNotebook, selectedSourceIds } from "@/lib/notebook-input";
import { readJsonBody, requiredString, RequestError, withRequestErrors } from "@/lib/request";

const GENERATION_TITLES: Record<string, string> = {
  summary: "Executive Summary",
  faq: "FAQ",
  study_guide: "Study Guide",
  timeline: "Timeline",
  key_topics: "Key Topics",
  concept_map: "Concept Map",
  audio_script: "Podcast Script",
};

export async function GET(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  return NextResponse.json(listGenerations(notebookId));
}

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  const notebookId = requireNotebook(body.notebookId);
  if (typeof body.type !== "string" || !Object.hasOwn(GENERATION_TITLES, body.type)) throw new RequestError("Invalid generation type");
  const type = body.type as Generation["type"];
  const sourceIds = selectedSourceIds(body.sourceIds, notebookId);

  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );

      try {
        for await (const text of streamGenerate(notebookId, type, sourceIds)) {
          fullContent += text;
          send({ type: "text", text });
        }

        // Save the generation
        const gen = createGeneration(
          notebookId,
          type,
          GENERATION_TITLES[type] ?? type,
          fullContent,
          sourceIds ?? []
        );
        send({ type: "done", generation: gen });
      } catch (err) {
        send({ type: "error", error: (err as Error).message });
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

export const DELETE = withRequestErrors(async function DELETE(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const { id: value } = await readJsonBody(req);
  const id = requiredString(value, "id");
  deleteGeneration(id);
  return NextResponse.json({ ok: true });
});
