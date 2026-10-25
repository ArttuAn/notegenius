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
    ? sourceIds.map((id) => getSource(id)).filter((s) => s?.notebook_id === notebookId && s.status === "ready")
    : listSources(notebookId).filter((s) => s.status === "ready");

  if (sources.length === 0) {
    yield "No sources available. Please add source documents to your notebook first.";
    return;
  }

  // Bound the provider payload even when the notebook contains many sources.
  let remaining = 64000;
  const context: string[] = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const text = `[Source ${context.length + 1}: "${source!.title}"]\n${source!.raw_text?.slice(0, 8000) ?? ""}`.slice(0, remaining);
    context.push(text);
    remaining -= text.length;
  }
  const sourceContext = context.join("\n\n---\n\n");

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
