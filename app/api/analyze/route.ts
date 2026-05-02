import { extractResumeText } from "@/lib/extract-resume-text";
import { analyzeResumeWithGroq } from "@/lib/groq-analyze";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing GROQ_API_KEY. Add it to .env.local (see .env.example).",
      },
      { status: 500 }
    );
  }

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
    const jobDescriptionRaw = formData.get("jobDescription");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Resume file is required" },
        { status: 400 }
      );
    }

    if (typeof jobDescriptionRaw !== "string") {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    const jobDescription = jobDescriptionRaw.trim();
    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description cannot be empty" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Resume file is empty" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Resume file is too large (max 10 MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let resumeText: string;

    try {
      resumeText = await extractResumeText(buffer, file.name, file.type);
    } catch (extractErr) {
      const message =
        extractErr instanceof Error ? extractErr.message : "Failed to read resume";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the resume" },
        { status: 400 }
      );
    }

    try {
      const result = await analyzeResumeWithGroq(
        resumeText,
        jobDescription,
        apiKey
      );
      return NextResponse.json(result);
    } catch (groqErr) {
      const message =
        groqErr instanceof Error ? groqErr.message : "Groq request failed";
      console.error(groqErr);
      return NextResponse.json(
        { error: message.includes("401") ? "Invalid Groq API key" : message },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Something went wrong while analyzing the resume" },
      { status: 500 }
    );
  }
}
