import { getClient, MODEL } from "./client";
import { GENERATE_PROMPTS } from "./prompts";
import { listSources, getSource } from "../db/queries/sources";
import type { Generation } from "../db/schema";

export async function* streamGenerate(
  notebookId: string,
  type: Generation["type"],
  sourceIds?: string[]
): AsyncGenerator<string> {
  const client = getClient();

  // Gather source texts
  const sources = sourceIds?.length
    ? sourceIds.map((id) => getSource(id)).filter(Boolean)
    : listSources(notebookId).filter((s) => s.status === "ready");

  if (sources.length === 0) {
    yield "No sources available. Please add source documents to your notebook first.";
    return;
  }

  const sourceContext = sources
    .map((s, i) => `[Source ${i + 1}: "${s!.title}"]\n${s!.raw_text?.slice(0, 8000) ?? ""}`)
    .join("\n\n---\n\n");

  const prompt = GENERATE_PROMPTS[type] ?? GENERATE_PROMPTS.summary;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n<sources>\n${sourceContext}\n</sources>`,
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
