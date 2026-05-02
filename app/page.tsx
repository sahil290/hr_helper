"use client";

import { useState } from "react";

type AnalyzeResponse = {
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

type ErrorBody = { error?: string };

function recClass(rec: string): string {
  if (rec === "Strong Match") return "matcher-rec matcher-rec-strong";
  if (rec === "Average") return "matcher-rec matcher-rec-avg";
  return "matcher-rec matcher-rec-low";
}

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please choose a resume file (PDF or DOCX).");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste a job description.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescription", jobDescription);

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data: AnalyzeResponse & ErrorBody = await res.json();

      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      setResult({
        score: data.score,
        matchedSkills: data.matchedSkills ?? [],
        missingSkills: data.missingSkills ?? [],
        recommendation: data.recommendation,
        summary: data.summary ?? "",
        strengths: data.strengths ?? [],
        gaps: data.gaps ?? [],
        interviewQuestions: data.interviewQuestions ?? [],
        improvementPlan: data.improvementPlan ?? [],
        riskFlags: data.riskFlags ?? [],
      });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="matcher-page">
      <header className="matcher-header">
        <h1>Resume – Job Description Matcher</h1>
        <p>
          Upload your resume and paste a job description. Analysis uses{" "}
          <strong>Llama 3.3 70B</strong> on Groq for a structured fit score,
          skills alignment, and concise strengths and gaps.
        </p>
      </header>

      <div className="matcher-grid">
        <section className="matcher-card">
          <h2>Inputs</h2>
          <form className="matcher-form" onSubmit={handleSubmit}>
            <div>
              <label className="matcher-label" htmlFor="resume">
                Resume (PDF or DOCX)
              </label>
              <input
                id="resume"
                name="resume"
                type="file"
                className="matcher-input-file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={loading}
                onChange={(ev) => {
                  setFile(ev.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
              />
            </div>

            <div>
              <label className="matcher-label" htmlFor="jd">
                Job description
              </label>
              <textarea
                id="jd"
                name="jobDescription"
                className="matcher-textarea"
                rows={12}
                value={jobDescription}
                disabled={loading}
                onChange={(ev) => {
                  setJobDescription(ev.target.value);
                  setResult(null);
                  setError(null);
                }}
                placeholder="Paste the full job description here…"
              />
            </div>

            <button
              type="submit"
              className="matcher-submit"
              disabled={loading}
            >
              {loading ? "Analyzing with Groq…" : "Analyze match"}
            </button>
          </form>
        </section>

        <div className="matcher-results-wrap">
          <section
            className={`matcher-card ${result ? "matcher-results-sticky" : ""}`}
          >
            <h2>Analysis</h2>

            {!result && !error && (
              <div className="matcher-empty-results">
                Results appear here next to your inputs—run an analysis to see
                score, summary, and skill chips without scrolling the whole page.
              </div>
            )}

            {error && (
              <div className="matcher-alert" role="alert">
                {error}
              </div>
            )}

            {result && (
              <div className="matcher-results-body">
                <div className="matcher-score-row">
                  <div className="matcher-score-badge">
                    <span className="matcher-score-label">Match score</span>
                    <span className="matcher-score-num">{result.score}%</span>
                  </div>
                  <span className={recClass(result.recommendation)}>
                    {result.recommendation}
                  </span>
                </div>

                {result.summary ? (
                  <p className="matcher-summary">{result.summary}</p>
                ) : null}

                {(result.strengths.length > 0 || result.gaps.length > 0) && (
                  <div className="matcher-lists-row">
                    {result.strengths.length > 0 && (
                      <div className="matcher-mini">
                        <h3>Strengths</h3>
                        <ul>
                          {result.strengths.map((s, i) => (
                            <li key={`${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.gaps.length > 0 && (
                      <div className="matcher-mini">
                        <h3>Gaps to address</h3>
                        <ul>
                          {result.gaps.map((s, i) => (
                            <li key={`${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {(result.riskFlags.length > 0 ||
                  result.interviewQuestions.length > 0 ||
                  result.improvementPlan.length > 0) && (
                  <div className="matcher-lists-row matcher-lists-row-3">
                    {result.riskFlags.length > 0 && (
                      <div className="matcher-mini">
                        <h3>Risk flags</h3>
                        <ul>
                          {result.riskFlags.map((s, i) => (
                            <li key={`risk-${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.interviewQuestions.length > 0 && (
                      <div className="matcher-mini">
                        <h3>Interview questions</h3>
                        <ul>
                          {result.interviewQuestions.map((s, i) => (
                            <li key={`iq-${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.improvementPlan.length > 0 && (
                      <div className="matcher-mini">
                        <h3>Improvement plan</h3>
                        <ul>
                          {result.improvementPlan.map((s, i) => (
                            <li key={`plan-${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="matcher-skills-section">
                  <div className="matcher-skill-col">
                    <h3>
                      In resume &amp; JD ({result.matchedSkills.length})
                    </h3>
                    <div className="matcher-chip-scroll">
                      {result.matchedSkills.length === 0 ? (
                        <p className="matcher-placeholder">None listed</p>
                      ) : (
                        result.matchedSkills.map((s) => (
                          <span key={s} className="matcher-chip matcher-chip-match">
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="matcher-skill-col">
                    <h3>Missing or weak ({result.missingSkills.length})</h3>
                    <div className="matcher-chip-scroll">
                      {result.missingSkills.length === 0 ? (
                        <p className="matcher-placeholder">None listed</p>
                      ) : (
                        result.missingSkills.map((s) => (
                          <span key={s} className="matcher-chip matcher-chip-miss">
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
