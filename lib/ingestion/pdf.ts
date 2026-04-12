export async function extractPdf(buffer: Buffer): Promise<{ title: string; text: string }> {
  // Dynamically import to avoid build-time issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParseModule = await import("pdf-parse") as any;
  const pdfParse = pdfParseModule.default ?? pdfParseModule;
  const data = await pdfParse(buffer);
  const title = data.info?.Title || `PDF Document`;
  return { title, text: data.text };
}
