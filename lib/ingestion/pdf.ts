export async function extractPdf(buffer: Buffer): Promise<{ title: string; text: string }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { title: "PDF Document", text: result.text ?? "" };
  } finally { await parser.destroy(); }
}
