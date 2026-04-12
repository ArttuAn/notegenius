import { getClient, MODEL } from "./client";
import { CHAT_SYSTEM } from "./prompts";
import { searchChunks } from "../db/queries/chunks";
import type { Citation } from "../db/schema";

export type ChatChunk =
  | { type: "text"; text: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "done" };

export async function* streamChat(
  notebookId: string,
  messages: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  topK = 8,
  sourceIds?: string[]
): AsyncGenerator<ChatChunk> {
  const client = getClient();

  // Retrieve relevant chunks
  const chunks = searchChunks(notebookId, userMessage, topK, sourceIds);

  // If no FTS results, fall back to sampling chunks from each source
  let contextChunks = chunks;
  if (contextChunks.length === 0 && !sourceIds) {
    const { db } = await import("../db");
    const fallback = db
      .prepare(
        `SELECT sc.*, s.title AS sourceTitle FROM source_chunks sc
         JOIN sources s ON sc.source_id = s.id
         WHERE sc.notebook_id = ?
         ORDER BY RANDOM() LIMIT ?`
      )
      .all(notebookId, topK) as typeof chunks;
    contextChunks = fallback;
  }

  // Build source context
  const citationMap: Map<number, { chunk: typeof chunks[0]; sourceTitle: string }> = new Map();
  const sourcesXml = contextChunks
    .map((chunk, i) => {
      citationMap.set(i + 1, { chunk, sourceTitle: chunk.sourceTitle });
      return `[${i + 1}] Source: "${chunk.sourceTitle}"
---
${chunk.text}
---`;
    })
    .join("\n\n");

  const systemPrompt = contextChunks.length > 0
    ? `${CHAT_SYSTEM}\n\n<sources>\n${sourcesXml}\n</sources>`
    : `${CHAT_SYSTEM}\n\nNote: No source documents have been added to this notebook yet. Let the user know they should add sources first.`;

  // Stream response
  let fullText = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      yield { type: "text", text: event.delta.text };
    }
  }

  // Parse citations from the completed text
  const citationPattern = /\[(\d+)\]/g;
  const usedIndices = new Set<number>();
  let match;
  while ((match = citationPattern.exec(fullText)) !== null) {
    usedIndices.add(parseInt(match[1]));
  }

  const citations: Citation[] = [];
  for (const idx of usedIndices) {
    const entry = citationMap.get(idx);
    if (entry) {
      citations.push({
        chunkId: entry.chunk.id,
        sourceId: entry.chunk.source_id,
        sourceTitle: entry.sourceTitle,
        passage: entry.chunk.text.slice(0, 300),
        charStart: entry.chunk.char_start,
        charEnd: entry.chunk.char_end,
        index: idx,
      });
    }
  }

  yield { type: "citations", citations };
  yield { type: "done" };
}
