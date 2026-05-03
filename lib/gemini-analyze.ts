import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiAnalysis = {
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

export type RoleMatch = {
  role: string;
  score: number;
  reason: string;
};

export type ResumeRoleFitAnalysis = {
  bestFitRole: string;
  bestFitScore: number;
  roleMatches: RoleMatch[];
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendedDepartments: string[];
};

const SYSTEM_PROMPT = `You are an expert HR and hiring manager advisor. Your audience is recruiters and hiring teams screening a candidate for a specific role.

Compare the candidate's resume to the job description (JD). Output is for internal hiring use—not coaching copy for the candidate.

Return ONLY a single JSON object with exactly these keys:
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

const ROLE_FIT_PROMPT = `You are an expert HR talent assessor.

Given ONLY a candidate resume, identify the job roles this candidate is most suitable for.

Return ONLY a single JSON object with exactly these keys:
- "bestFitRole": string (single best role title)
- "bestFitScore": number from 0 to 100
- "roleMatches": array of 5 objects sorted by score desc, each object:
  - "role": string (role title)
  - "score": number (0-100)
  - "reason": short evidence-based reason (1 sentence)
- "summary": 2-3 sentence HR summary of candidate profile and fit.
- "strengths": 4-7 short bullet strings from resume evidence.
- "concerns": 3-6 short bullet strings for hiring concerns/gaps/unknowns.
- "recommendedDepartments": 2-5 strings (e.g. "Sales", "Customer Success", "Operations")

Constraints:
- Use only evidence from the resume text.
- Do not invent certifications/skills.
- SCORING RUBRIC: 90-100 (Exceptional match), 75-89 (Strong), 60-74 (Moderate), <60 (Weak).
- BE CRITICAL: Do not default to high scores. A 92% is reserved for elite matches. If a candidate is just "okay", give a score in the 60s or 70s.
- Keep output concise, professional, and useful for HR screening.`;

const PEER_RANKING_PROMPT = `You are an elite talent arbitrator.
You will be given multiple resumes for a specific role.
Your task is to rank these candidates from best to worst based ONLY on their resume depth, intelligence, and relevant experience.

Return ONLY a single JSON object with:
- "rankings": array of objects, one for each candidate:
  - "name": candidate name or filename
  - "rank": integer (1 for best)
  - "intelligenceScore": 0-100 (based on pedigree, complexity of work, and achievements)
  - "fitScore": 0-100 (relevance to the target role)
  - "verdict": why this candidate is in this position
- "overallWinner": string (name of the #1 candidate)
- "summary": 2-3 sentence overview of the group's quality.

Be brutal and decisive. No ties.`;

const MAX_CHARS = 120_000;

function truncateBlock(label: string, text: string, budget: number): string {
  if (text.length <= budget) return text;
  return `${text.slice(0, budget)}\n\n[${label} truncated for length]`;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  try {
    // Gemini often wraps JSON in markdown code blocks
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(trimmed);
  } catch {
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

function asRoleMatches(v: unknown): RoleMatch[] {
  if (!Array.isArray(v)) return [];
  const out: RoleMatch[] = [];

  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const role = typeof (item as Record<string, unknown>).role === "string"
      ? ((item as Record<string, unknown>).role as string).trim()
      : "";
    const reason = typeof (item as Record<string, unknown>).reason === "string"
      ? ((item as Record<string, unknown>).reason as string).trim()
      : "";
    const score = coerceScore((item as Record<string, unknown>).score);
    if (!role) continue;
    out.push({ role, score, reason });
    if (out.length >= 8) break;
  }

  return out;
}

export function normalizeGeminiPayload(raw: unknown): GeminiAnalysis {
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

export function normalizeRoleFitPayload(raw: unknown): ResumeRoleFitAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid role-fit payload");
  }
  const o = raw as Record<string, unknown>;
  const roleMatches = asRoleMatches(o.roleMatches).sort((a, b) => b.score - a.score);
  const fallbackTop = roleMatches[0];

  const bestFitRole =
    typeof o.bestFitRole === "string" && o.bestFitRole.trim()
      ? o.bestFitRole.trim()
      : fallbackTop?.role ?? "Unknown";
  const bestFitScore = coerceScore(o.bestFitScore ?? fallbackTop?.score ?? 0);
  const summary =
    typeof o.summary === "string" && o.summary.trim()
      ? o.summary.trim()
      : "No summary provided.";

  return {
    bestFitRole,
    bestFitScore,
    roleMatches,
    summary,
    strengths: asStringArray(o.strengths, 10),
    concerns: asStringArray(o.concerns, 10),
    recommendedDepartments: asStringArray(o.recommendedDepartments, 6),
  };
}

export async function analyzeResumeWithGemini(
  resumeText: string,
  jobDescription: string
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in environment");
  const half = Math.floor((MAX_CHARS - 2000) / 2);
  const jd = truncateBlock("Job description", jobDescription, half);
  const resume = truncateBlock("Resume", resumeText, half);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
        responseMimeType: "application/json",
    }
  });

  const prompt = `${SYSTEM_PROMPT}\n\nJOB DESCRIPTION:\n${jd}\n\n---\n\nRESUME:\n${resume}`;
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) {
    throw new Error("Empty response from Gemini");
  }

  const parsed = parseJsonObject(content);
  return normalizeGeminiPayload(parsed);
}

export async function analyzeResumeRoleFitWithGemini(
  resumeText: string
): Promise<ResumeRoleFitAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in environment");
  const resume = truncateBlock("Resume", resumeText, MAX_CHARS - 2000);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
        responseMimeType: "application/json",
    }
  });

  const prompt = `${ROLE_FIT_PROMPT}\n\nRESUME:\n${resume}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) {
    throw new Error("Empty response from Gemini");
  }

  const parsed = parseJsonObject(content);
  return normalizeRoleFitPayload(parsed);
}

export async function analyzePeerRankingWithGemini(
  role: string,
  candidates: { name: string; text: string }[]
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in environment");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
        responseMimeType: "application/json",
    }
  });

  const resumeContent = candidates.map((c, i) => `CANDIDATE ${i + 1} (${c.name}):\n${c.text.slice(0, 5000)}`).join("\n\n---\n\n");
  const prompt = `${PEER_RANKING_PROMPT}\n\nTARGET ROLE: ${role}\n\nRESUMES:\n${resumeContent}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) throw new Error("Empty response from Gemini");
  return parseJsonObject(content);
}
