export type Chunk = {
  text: string;
  charStart: number;
  charEnd: number;
  index: number;
};

export function chunkText(
  text: string,
  chunkSize = 1200,
  overlap = 200
): Chunk[] {
  if (!text || text.length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at sentence or paragraph boundary
    if (end < text.length) {
      const breakChars = ["\n\n", "\n", ". ", "? ", "! "];
      let bestBreak = -1;
      for (const br of breakChars) {
        const pos = text.lastIndexOf(br, end);
        if (pos > start + chunkSize * 0.5) {
          bestBreak = pos + br.length;
          break;
        }
      }
      if (bestBreak > start) end = bestBreak;
    }

    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, charStart: start, charEnd: end, index });
      index++;
    }

    // The window has reached the end of the document, so there is nothing
    // left to advance into. Without this, `start` creeps forward one
    // character at a time while `end` stays pinned at text.length, emitting
    // one near-duplicate tail chunk per overlap character — 200 of them by
    // default, on every document. They bloat the index and crowd real
    // passages out of the top-k search results.
    if (end >= text.length) break;

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}
