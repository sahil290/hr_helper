import { extractResumeText } from "@/lib/extract-resume-text";
import { analyzeResumeRoleFitWithGemini } from "@/lib/gemini-analyze";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Resume file is required" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Resume file is empty" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Resume file is too large (max 10 MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resumeText = await extractResumeText(buffer, file.name, file.type);
    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the resume" },
        { status: 400 }
      );
    }

    const result = await analyzeResumeRoleFitWithGemini(resumeText);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("❌ Role-Fit API Error:", e.message || e);
    return NextResponse.json(
      { error: `Analysis failed: ${e.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
