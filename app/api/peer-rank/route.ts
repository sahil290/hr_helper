import { extractResumeText } from "@/lib/extract-resume-text";
import { analyzePeerRankingWithGroq } from "@/lib/groq-analyze";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const role = formData.get("role") as string;
    const files = formData.getAll("resumes") as File[];

    if (!role || files.length < 2) {
      return NextResponse.json({ error: "Role and at least 2 resumes required" }, { status: 400 });
    }

    const candidates = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractResumeText(buffer, file.name, file.type);
      candidates.push({ name: file.name, text });
    }

    const result = await analyzePeerRankingWithGroq(role, candidates, apiKey);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
