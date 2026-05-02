import Groq from "groq-sdk";

export const GROQ_MODEL = "llama-3.3-70b-versatile";

export type GroqAnalysis = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  interviewQuestions: string[];
  improvementPlan: string[];
  riskFlags: string[];
};

const SYSTEM_PROMPT = `You are an expert HR and hiring manager advisor. Your audience is recruiters and hiring teams screening a candidate for a specific role.

Compare the candidate's resume to the job description (JD). Output is for internal hiring use—not coaching copy for the candidate.

Return ONLY a single JSON object (no markdown, no code fences) with exactly these keys:
- "score": number from 0 to 100 (one decimal place max). Base this on how well the candidate's experience and skills satisfy the JD (not naive word overlap).
- "matchedSkills": array of up to 25 strings: concrete skills, tools, technologies, or qualifications from the JD that the resume clearly demonstrates. Use Title Case short phrases (e.g. "React", "REST APIs", "Bachelor's Degree").
- "missingSkills": array of up to 25 strings: important JD requirements weak or absent from the resume. Title Case, no duplicates from matchedSkills.
- "recommendation": exactly one of: "Strong Match", "Average", "Low Match" — use Strong Match if score > 75, Average if score is 50–75 inclusive, Low Match if score < 50.
- "summary": 2–3 sentences in plain professional English for HR: overview of fit for this role.
- "strengths": 3–5 short bullets: evidence-based reasons to advance or shortlist this candidate.
- "gaps": 3–5 short bullets: requirements not met, unclear from the resume, or need verification.
- "interviewQuestions": 3–5 specific questions the hiring team should ask to validate gaps or claims.
- "improvementPlan": 3–6 short bullets for the hiring team only: next screening steps (e.g. verify employment, request work samples, reference themes, internal calibration)—NOT advice telling the candidate how to rewrite their resume.
- "riskFlags": 2–5 potential hiring concerns (short, evidence-based; flag inconsistencies or sensitive gaps only when grounded in the text).

Be evidence-based: only list matchedSkills when the resume text supports them.`;

const MAX_CHARS = 120_000;

function truncateBlock(label: string, text: string, budget: number): string {
  if (text.length <= budget) return text;
  return `${text.slice(0, budget)}\n\n[${label} truncated for length]`;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON");
  }
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim();
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function coerceScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

export function normalizeGroqPayload(raw: unknown): GroqAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid analysis payload");
  }
  const o = raw as Record<string, unknown>;
  const score = coerceScore(o.score);
  const matchedSkills = asStringArray(o.matchedSkills, 25);
  const missingSkills = asStringArray(o.missingSkills, 25);
  const summary =
    typeof o.summary === "string" && o.summary.trim()
      ? o.summary.trim()
      : "No summary provided.";
  const strengths = asStringArray(o.strengths, 8);
  const gaps = asStringArray(o.gaps, 8);
  const interviewQuestions = asStringArray(o.interviewQuestions, 8);
  const improvementPlan = asStringArray(o.improvementPlan, 8);
  const riskFlags = asStringArray(o.riskFlags, 8);
  const recommendation =
    score > 75 ? "Strong Match" : score >= 50 ? "Average" : "Low Match";

  return {
    score,
    matchedSkills,
    missingSkills,
    recommendation,
    summary,
    strengths,
    gaps,
    interviewQuestions,
    improvementPlan,
    riskFlags,
  };
}

export async function analyzeResumeWithGroq(
  resumeText: string,
  jobDescription: string,
  apiKey: string
): Promise<GroqAnalysis> {
  const half = Math.floor((MAX_CHARS - 2000) / 2);
  const jd = truncateBlock("Job description", jobDescription, half);
  const resume = truncateBlock("Resume", resumeText, half);

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jd}\n\n---\n\nRESUME:\n${resume}`,
      },
    ],
    temperature: 0.25,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Groq");
  }

  const parsed = parseJsonObject(content);
  return normalizeGroqPayload(parsed);
}
