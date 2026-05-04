import { extractResumeText } from "@/lib/extract-resume-text";
import { analyzePeerRanking, AIProvider } from "@/lib/ai-analyze";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let role: string;
    let candidates: { name: string; text: string; file?: { data: string; mimeType: string } }[] = [];
    let provider: AIProvider = "gemini";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      role = body.role;
      candidates = body.candidates;
      provider = body.provider || "gemini";
    } else {
      const formData = await request.formData();
      role = formData.get("role") as string;
      provider = (formData.get("provider") as AIProvider) || "gemini";
      const files = formData.getAll("resumes") as File[];

      if (!role || files.length < 2) {
        return NextResponse.json({ error: "Role and at least 2 resumes required" }, { status: 400 });
      }

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await extractResumeText(buffer, file.name, file.type);
        
        const isScanned = text.trim().length < 50;
        const candidate: any = { name: file.name, text };
        
        if (isScanned) {
          candidate.file = {
            data: buffer.toString("base64"),
            mimeType: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream")
          };
        }
        
        candidates.push(candidate);
      }
    }

    if (!role || !candidates || candidates.length < 2) {
      return NextResponse.json({ error: "Role and at least 2 candidates required" }, { status: 400 });
    }

    const result = await analyzePeerRanking(role, candidates, provider);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
