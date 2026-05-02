import mammoth from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isPdf(filename: string, mime: string): boolean {
  return mime === PDF_MIME || filename.toLowerCase().endsWith(".pdf");
}

function isDocx(filename: string, mime: string): boolean {
  return (
    mime === DOCX_MIME ||
    filename.toLowerCase().endsWith(".docx")
  );
}

export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const safeName = filename || "resume";
  const mime = mimeType || "application/octet-stream";

  if (isPdf(safeName, mime)) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return typeof result.text === "string" ? result.text : "";
  }

  if (isDocx(safeName, mime)) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value ?? "";
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF or DOCX file."
  );
}
