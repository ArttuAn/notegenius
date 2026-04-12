export async function extractText(content: string): Promise<{ title: string; text: string }> {
  return {
    title: content.slice(0, 60).split("\n")[0].trim() || "Text Document",
    text: content,
  };
}
