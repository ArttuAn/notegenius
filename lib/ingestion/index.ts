import { chunkText } from "./chunker";
import { extractText } from "./text";
import { extractPdf } from "./pdf";
import { extractUrl } from "./url";
import { extractYoutube } from "./youtube";
import {
  updateSourceStatus,
  getSource,
} from "../db/queries/sources";
import { insertChunks } from "../db/queries/chunks";
import { touchNotebook } from "../db/queries/notebooks";
import { db } from "../db";

export async function ingestSource(sourceId: string): Promise<void> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found`);

  updateSourceStatus(sourceId, "processing");

  try {
    let extracted: { title: string; text: string };

    switch (source.type) {
      case "pdf":
        // raw_text stored temporarily as base64 during upload
        const b64 = source.raw_text ?? "";
        const buffer = Buffer.from(b64, "base64");
        extracted = await extractPdf(buffer);
        break;
      case "url":
        extracted = await extractUrl(source.origin);
        break;
      case "youtube":
        extracted = await extractYoutube(source.origin);
        break;
      case "text":
        extracted = await extractText(source.origin);
        break;
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }

    // Get chunk settings
    const settings = db
      .prepare("SELECT key, value FROM settings WHERE key IN ('chunk_size', 'chunk_overlap')")
      .all() as { key: string; value: string }[];
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]));
    const chunkSize = settingsMap.chunk_size ?? 1200;
    const chunkOverlap = settingsMap.chunk_overlap ?? 200;

    const chunks = chunkText(extracted.text, chunkSize, chunkOverlap);

    insertChunks(
      chunks.map((c) => ({
        sourceId,
        notebookId: source.notebook_id,
        chunkIndex: c.index,
        text: c.text,
        charStart: c.charStart,
        charEnd: c.charEnd,
      }))
    );

    updateSourceStatus(sourceId, "ready", {
      rawText: extracted.text,
      charCount: extracted.text.length,
    });

    // Update title if it was auto-detected
    if (extracted.title && source.title === "Processing...") {
      db.prepare("UPDATE sources SET title = ? WHERE id = ?").run(
        extracted.title,
        sourceId
      );
    }

    touchNotebook(source.notebook_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateSourceStatus(sourceId, "error", { errorMsg: msg });
    throw err;
  }
}
