export async function extractPdf(buffer: Buffer): Promise<{ title: string; text: string }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const title = `PDF Document`;
  return { title, text: result.text ?? "" };
}
