import { NextRequest, NextResponse } from "next/server";
import { streamGenerate } from "@/lib/ai/generate";
import { createGeneration, listGenerations, deleteGeneration } from "@/lib/db/queries/generations";
import type { Generation } from "@/lib/db/schema";

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
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  return NextResponse.json(listGenerations(notebookId));
}

export async function POST(req: NextRequest) {
  const { notebookId, type, sourceIds } = await req.json() as {
    notebookId: string;
    type: Generation["type"];
    sourceIds?: string[];
  };

  if (!notebookId || !type) {
    return NextResponse.json({ error: "notebookId and type required" }, { status: 400 });
  }

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
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deleteGeneration(id);
  return NextResponse.json({ ok: true });
}
