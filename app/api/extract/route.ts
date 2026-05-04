import { extractResumeText } from "@/lib/extract-resume-text";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(buffer, file.name, file.type);
    
    const isScanned = text.trim().length < 50;
    const responseData: any = { text, isScanned };
    
    if (isScanned) {
      responseData.fileData = {
        data: buffer.toString("base64"),
        mimeType: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream")
      };
    }

    return NextResponse.json(responseData);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
