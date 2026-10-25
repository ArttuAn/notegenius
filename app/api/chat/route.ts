import { authorizeRequest } from "@/lib/auth";
import { NextRequest } from "next/server";
import { streamChat } from "@/lib/ai/chat";
import { getSession, listMessages, insertMessage } from "@/lib/db/queries/sessions";
import { getSettings } from "@/lib/db/queries/settings";
import { requireNotebook, selectedSourceIds } from "@/lib/notebook-input";
import { readJsonBody, requiredString, RequestError, withRequestErrors } from "@/lib/request";
import type { Citation } from "@/lib/db/schema";

export const POST = withRequestErrors(async function POST(req: NextRequest) {
  const denied = authorizeRequest(req);
  if (denied) return denied;
  const body = await readJsonBody(req);
  const notebookId = requireNotebook(body.notebookId);
  const sessionId = requiredString(body.sessionId, "sessionId");
  const message = requiredString(body.message, "message", 16000);
  const sourceIds = selectedSourceIds(body.sourceIds, notebookId);
  const session = getSession(sessionId);
  if (!session || session.notebook_id !== notebookId) throw new RequestError("Chat session does not belong to this notebook", 404);

  // Save user message
  insertMessage(sessionId, notebookId, "user", message);

  // Get conversation history (last 10 exchanges = 20 messages)
  const history = listMessages(sessionId).slice(-20);
  const priorMessages = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Get settings
  const topK = getSettings().top_k;

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
});
