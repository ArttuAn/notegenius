import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/ai/chat";
import { listMessages, insertMessage } from "@/lib/db/queries/sessions";
import type { Citation } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const { notebookId, sessionId, message, sourceIds } = await req.json();

  if (!notebookId || !sessionId || !message) {
    return NextResponse.json({ error: "notebookId, sessionId, and message required" }, { status: 400 });
  }

  // Save user message
  insertMessage(sessionId, notebookId, "user", message);

  // Get conversation history (last 10 exchanges = 20 messages)
  const history = listMessages(sessionId).slice(-20);
  const priorMessages = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Get settings
  const { db } = await import("@/lib/db");
  const topKRow = db.prepare("SELECT value FROM settings WHERE key = 'top_k'").get() as { value: string } | null;
  const topK = parseInt(topKRow?.value ?? "8");

  let fullText = "";
  let citations: Citation[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        );

      try {
        for await (const chunk of streamChat(
          notebookId,
          priorMessages.slice(0, -1), // Exclude the just-saved user message
          message,
          topK,
          sourceIds
        )) {
          if (chunk.type === "text") {
            fullText += chunk.text;
            send({ type: "text", text: chunk.text });
          } else if (chunk.type === "citations") {
            citations = chunk.citations;
            send({ type: "citations", citations });
          } else if (chunk.type === "done") {
            // Save assistant message
            const saved = insertMessage(sessionId, notebookId, "assistant", fullText, citations);
            send({ type: "done", messageId: saved.id });
          }
        }
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
