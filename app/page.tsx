"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";


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

type RoleFitResponse = {
  bestFitRole: string;
  bestFitScore: number;
  roleMatches: { role: string; score: number; reason: string }[];
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendedDepartments: string[];
};

type ProfileLink = {
  id: string;
  platform: string;
  url: string;
  label: string;
};

type PipelineItem = {
  id: string;
  name: string;
  role: string;
  stage: string;
  score: number;
  summary: string;
  created_at?: string;
};

const PIPELINE_STAGES = [
  { id: "new", name: "New", icon: "✨" },
  { id: "screened", name: "Screened", icon: "🔍" },
  { id: "interview", name: "Interview", icon: "💬" },
  { id: "offered", name: "Offered", icon: "📄" },
  { id: "hired", name: "Hired", icon: "🎉" },
  { id: "rejected", name: "Rejected", icon: "❌" },
];

const PLATFORMS = [
  { id: "linkedin", name: "LinkedIn", icon: "in" },
  { id: "naukri", name: "Naukri", icon: "N" },
  { id: "indeed", name: "Indeed", icon: "I" },
  { id: "glassdoor", name: "Glassdoor", icon: "G" },
  { id: "wellfound", name: "Wellfound", icon: "W" },
  { id: "upwork", name: "Upwork", icon: "Up" },
  { id: "foundit", name: "Foundit", icon: "F" },
  { id: "monster", name: "Monster", icon: "M" },
  { id: "hired", name: "Hired", icon: "H" },
  { id: "generic", name: "Other", icon: "🔗" },
];

type ErrorBody = { error?: string };

function recClass(rec: string): string {
  if (rec === "Strong Match") return "matcher-rec matcher-rec-strong";
  if (rec === "Average") return "matcher-rec matcher-rec-avg";
  return "matcher-rec matcher-rec-low";
}

function getScoreClass(score: number): string {
  if (score >= 80) return "score-high";
  if (score >= 50) return "score-med";
  return "score-low";
}

function AnalyticsDashboard({ items }: { items: PipelineItem[] }) {
  const total = items.length;
  const avgScore = total > 0 ? Math.round(items.reduce((acc, curr) => acc + curr.score, 0) / total) : 0;
  const topTalent = items.filter(i => i.score >= 85).length;
  
  const stageStats = PIPELINE_STAGES.map(s => ({
    ...s,
    count: items.filter(i => i.stage === s.id).length
  }));

  return (
    <div className="analytics-grid">
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Candidates</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: getScoreClass(avgScore).includes('high') ? 'var(--success)' : 'var(--warning)' }}>
            {avgScore}%
          </div>
          <div className="stat-label">Avg. Match Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{topTalent}</div>
          <div className="stat-label">Top Talent (85+)</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="matcher-card">
          <h3>Pipeline Distribution</h3>
          <div className="stage-bars">
            {stageStats.map(s => (
              <div key={s.id} className="stage-bar-item">
                <div className="stage-bar-label">
                  <span>{s.icon} {s.name}</span>
                  <span>{s.count}</span>
                </div>
                <div className="stage-bar-bg">
                  <div 
                    className="stage-bar-fill" 
                    style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="matcher-card">
          <h3>Score Distribution</h3>
          <div className="score-ranges">
             {[
               { range: '90-100', count: items.filter(i => i.score >= 90).length, color: 'var(--success)' },
               { range: '70-89', count: items.filter(i => i.score >= 70 && i.score < 90).length, color: 'var(--accent)' },
               { range: '50-69', count: items.filter(i => i.score >= 50 && i.score < 70).length, color: 'var(--warning)' },
               { range: '< 50', count: items.filter(i => i.score < 50).length, color: 'var(--danger)' },
             ].map(r => (
               <div key={r.range} className="score-range-item">
                 <div className="range-label">{r.range}</div>
                 <div className="range-bar-bg">
                    <div className="range-bar-fill" style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%`, background: r.color }} />
                 </div>
                 <div className="range-count">{r.count}</div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<
    "screening" | "rolefit" | "profiles" | "pipeline" | "comparison" | "peer-ranking" | "analytics"
  >("analytics");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [roleFile, setRoleFile] = useState<File | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleResult, setRoleResult] = useState<RoleFitResponse | null>(null);

  // Comparison State
  const [comparisonFiles, setComparisonFiles] = useState<File[]>([]);
  const [comparisonJobDesc, setComparisonJobDesc] = useState("");
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any[]>([]);

  // Peer Ranking State
  const [peerRankFiles, setPeerRankFiles] = useState<File[]>([]);
  const [peerRankRole, setPeerRankRole] = useState("");
  const [peerRankLoading, setPeerRankLoading] = useState(false);
  const [peerRankResult, setPeerRankResult] = useState<any>(null);

  // Provider State
  const [provider, setProvider] = useState<"gemini" | "groq">("gemini");

  // Profiles State
  const [profiles, setProfiles] = useState<ProfileLink[]>([]);
  const [newPlatform, setNewPlatform] = useState("linkedin");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);

  // Pipeline State
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([]);
  const [isAddingToPipeline, setIsAddingToPipeline] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Theme and Session Setup
  useEffect(() => {
    const auth = sessionStorage.getItem("hr-auth");
    if (auth === "true") setIsAuthenticated(true);
    
    const savedTheme = localStorage.getItem("hr-theme");
    if (savedTheme === "dark") setIsDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("hr-theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [isDarkMode]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "HR@2026") {
      setIsAuthenticated(true);
      sessionStorage.setItem("hr-auth", "true");
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("hr-auth");
  };

  // Load profiles from localStorage
  // Load profiles from Supabase on mount
  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error) {
          setProfiles(data);
          localStorage.setItem("hr_profiles", JSON.stringify(data));
        } else if (error) {
          console.warn("Supabase fetch failed, using localStorage:", error);
          const saved = localStorage.getItem("hr_profiles");
          if (saved) setProfiles(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to sync with Supabase", e);
        const saved = localStorage.getItem("hr_profiles");
        if (saved) setProfiles(JSON.parse(saved));
      }
    }
    loadProfiles();
  }, []);

  // Pipeline Logic
  useEffect(() => {
    async function loadPipeline() {
      const { data, error } = await supabase
        .from('pipeline')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setPipelineItems(data);
      }
    }
    if (isAuthenticated) loadPipeline();
  }, [isAuthenticated]);

  const updateStage = async (id: string, newStage: string) => {
    const updated = pipelineItems.map(item => 
      item.id === id ? { ...item, stage: newStage } : item
    );
    setPipelineItems(updated);

    const { error } = await supabase
      .from('pipeline')
      .update({ stage: newStage })
      .eq('id', id);
    
    if (error) console.error("Pipeline update error:", error);
  };

  const addToPipeline = async (name: string, role: string, score: number, summary: string, sourceId: string, initialStage: string = "new") => {
    setAddingId(sourceId);
    const newItem = {
      name,
      role,
      stage: initialStage,
      score,
      summary
    };

    try {
      const { data, error } = await supabase.from('pipeline').insert([newItem]).select();
      if (error) {
        console.error("❌ Pipeline Insert Error:", JSON.stringify(error, null, 2));
      } else if (data) {
        setPipelineItems([data[0], ...pipelineItems]);
      }
    } finally {
      setTimeout(() => setAddingId(null), 1000); // Visual feedback
    }
  };

  const deletePipelineItem = async (id: string) => {
    setPipelineItems(pipelineItems.filter(i => i.id !== id));
    const { error } = await supabase.from('pipeline').delete().eq('id', id);
    if (error) console.error("Pipeline delete error:", error);
  };

  const handleComparisonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comparisonFiles.length < 2) return alert("Please select at least 2 resumes.");
    if (!comparisonJobDesc) return alert("Please enter the job description.");

    setComparisonLoading(true);
    setComparisonResult([]);

    try {
      // For each file, run analysis
      const results = [];
      for (const file of comparisonFiles) {
        const formData = new FormData();
        formData.append("resume", file);
        formData.append("jobDescription", comparisonJobDesc);

        const res = await fetch("/api/analyze", { method: "POST", body: formData });
        const data = await res.json();
        results.push({ name: file.name, ...data });
      }
      setComparisonResult(results);
    } catch (err) {
      console.error(err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const handlePeerRankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (peerRankFiles.length < 2) return alert("Select at least 2 resumes.");
    if (!peerRankRole) return alert("Enter the target role.");

    setPeerRankLoading(true);
    setPeerRankResult(null);

    try {
      const candidates = [];
      
      // Step 1: Extract text from each file sequentially to avoid payload limits
      for (const file of peerRankFiles) {
        const formData = new FormData();
        formData.append("file", file);
        
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          body: formData,
        });
        
        const extractData = await extractRes.json();
        if (!extractRes.ok) throw new Error(extractData.error || `Failed to extract text from ${file.name}`);
        
        candidates.push({ 
          name: file.name, 
          text: extractData.text,
          file: extractData.fileData // This will be present if isScanned is true
        });
      }

      // Step 2: Send the extracted texts as JSON
      const res = await fetch("/api/peer-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: peerRankRole, candidates, provider }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPeerRankResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPeerRankLoading(false);
    }
  };

  const addProfileLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    const newLink: ProfileLink = {
      id: crypto.randomUUID(),
      platform: newPlatform,
      url: newUrl.startsWith("http") ? newUrl : `https://${newUrl}`,
      label: newLabel.trim() || newUrl,
    };

    // Optimistic Update
    const updated = [newLink, ...profiles];
    setProfiles(updated);
    localStorage.setItem("hr_profiles", JSON.stringify(updated));

    // Save to Supabase
    try {
      const { error } = await supabase.from('profiles').insert([
        {
          id: newLink.id,
          platform: newLink.platform,
          url: newLink.url,
          label: newLink.label
        }
      ]);
      if (error) console.error("Supabase insert error:", error);
    } catch (err) {
      console.error("Supabase error:", err);
    }

    setNewUrl("");
    setNewLabel("");
  };

  const deleteLink = async (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    setProfiles(updated);
    localStorage.setItem("hr_profiles", JSON.stringify(updated));

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) console.error("Supabase delete error:", error);
    } catch (err) {
      console.error("Supabase error:", err);
    }
  };

  const openAll = (platformId: string) => {
    const links = profiles.filter((p) => p.platform === platformId);
    links.forEach((l) => window.open(l.url, "_blank"));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please upload the candidate's resume (PDF or DOCX).");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste the role's job description.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescription", jobDescription);
    formData.append("provider", provider);

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

  async function handleRoleFitSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRoleError(null);
    setRoleResult(null);

    if (!roleFile) {
      setRoleError("Please upload the candidate's resume (PDF or DOCX).");
      return;
    }

    const formData = new FormData();
    formData.append("resume", roleFile);
    formData.append("provider", provider);

    setRoleLoading(true);
    try {
      const res = await fetch("/api/role-fit", {
        method: "POST",
        body: formData,
      });

      const data: RoleFitResponse & ErrorBody = await res.json();
      if (!res.ok) {
        setRoleError(data.error || `Request failed (${res.status})`);
        return;
      }

      setRoleResult({
        bestFitRole: data.bestFitRole,
        bestFitScore: data.bestFitScore,
        roleMatches: data.roleMatches ?? [],
        summary: data.summary ?? "",
        strengths: data.strengths ?? [],
        concerns: data.concerns ?? [],
        recommendedDepartments: data.recommendedDepartments ?? [],
      });
    } catch {
      setRoleError("Network error. Try again.");
    } finally {
      setRoleLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="matcher-kicker">✨ AM Group Recruitment</div>
          <h1>AM Talent Hub</h1>
          <p>Please enter your access password to continue.</p>
          <form onSubmit={handleLogin} className="matcher-form">
            <div className="input-group">
              <input
                type="password"
                placeholder="Enter password..."
                value={password || ""}
                onChange={(e) => setPassword(e.target.value)}
                className={loginError ? "input-error" : ""}
                required
              />
              <button type="submit" className="matcher-submit">
                Access Dashboard
              </button>
            </div>
            {loginError && (
              <p className="error-text">Incorrect password. Please try again.</p>
            )}
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="matcher-page">
      <nav className="main-navbar">
        <div className="nav-brand">
          <span>✨</span> AM Talent Hub
        </div>
        <div className="nav-actions">
          {/* Module Selector */}
          <div className="custom-dropdown">
            <div className="dropdown-trigger">
              <span className="dropdown-label">Module:</span>
              <span className="dropdown-value">
                {activeSection === 'peer-ranking' ? 'Arbitration' : 
                 activeSection === 'rolefit' ? 'Role-Fit' :
                 activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
              </span>
              <span className="dropdown-chevron">▼</span>
            </div>
            <div className="dropdown-menu">
              {[
                {id: 'analytics', label: 'Analytics'},
                {id: 'screening', label: 'Screening'},
                {id: 'pipeline', label: 'Pipeline'},
                {id: 'comparison', label: 'Comparison'},
                {id: 'peer-ranking', label: 'Arbitration'},
                {id: 'rolefit', label: 'Role-Fit'},
                {id: 'profiles', label: 'Profiles'}
              ].map(opt => (
                <div 
                  key={opt.id} 
                  className={`dropdown-item ${activeSection === opt.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(opt.id as any)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>

          {/* AI Engine Selector */}
          <div className="custom-dropdown">
            <div className="dropdown-trigger">
              <span className="dropdown-label">AI Engine:</span>
              <span className="dropdown-value">
                {provider === 'gemini' ? 'Gemini' : 'Groq (Llama 3.3)'}
              </span>
              <span className="dropdown-chevron">▼</span>
            </div>
            <div className="dropdown-menu">
              {[
                {id: 'gemini', label: 'Gemini'},
                {id: 'groq', label: 'Groq (Llama 3.3)'}
              ].map(opt => (
                <div 
                  key={opt.id} 
                  className={`dropdown-item ${provider === opt.id ? 'active' : ''}`}
                  onClick={() => setProvider(opt.id as any)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>

          <button 
            className="btn-theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout <span>🚪</span>
          </button>
        </div>
      </nav>

      <header className="matcher-header">
        <h1>
          {activeSection === "screening" && "Candidate Screening"}
          {activeSection === "rolefit" && "Role-Fit Analysis"}
          {activeSection === "profiles" && "Recruiter Profiles"}
          {activeSection === "pipeline" && "Candidate Pipeline"}
          {activeSection === "comparison" && "Comparison Matrix"}
          {activeSection === "peer-ranking" && "Peer Ranking arbitrator"}
          {activeSection === "analytics" && "Recruitment Analytics"}
        </h1>
        <div className="matcher-welcome">AM Group Recruitment Command Center</div>
        <p>
          {activeSection === "screening" && "Proprietary AI screening tailored for AM Group's high-performance recruitment."}
          {activeSection === "rolefit" && "Identify the best internal or external roles for AM Group candidates."}
          {activeSection === "profiles" && "Centralized hub for AM Group's recruiter presence across platforms."}
          {activeSection === "pipeline" && "AM Group's visual candidate journey and stage management."}
          {activeSection === "comparison" && "Advanced matrix for AM Group's final selection process."}
          {activeSection === "peer-ranking" && "Arbitrate between top AM Group prospects with AI precision."}
          {activeSection === "analytics" && "Real-time insights and bottleneck detection for AM Group talent acquisition."}
        </p>
      </header>


      {activeSection === "screening" ? (
        <section className="glass-shell">
          <div className="matcher-grid">
            <section className="matcher-card">
              <h2><span>📄</span> Candidate &amp; role</h2>
              <form className="matcher-form" onSubmit={handleSubmit}>
                <div>
                  <label className="matcher-label" htmlFor="resume">
                    Candidate resume (PDF or DOCX)
                  </label>
                  <input
                    key="screening-resume"
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
                    Job description for this role
                  </label>
                  <textarea
                    id="jd"
                    name="jobDescription"
                    className="matcher-textarea"
                    rows={12}
                    value={jobDescription || ""}
                    disabled={loading}
                    onChange={(ev) => {
                      setJobDescription(ev.target.value);
                      setResult(null);
                      setError(null);
                    }}
                    placeholder="Paste the full JD for the requisition you are screening…"
                  />
                </div>

                <button
                  type="submit"
                  className="matcher-submit"
                  disabled={loading}
                >
                  {loading ? "Running screening…" : "Run screening"}
                </button>
              </form>
            </section>

            <div className="matcher-results-wrap">
              <section
                className={`matcher-card ${result ? "matcher-results-sticky" : ""}`}
              >
                <h2><span>📊</span> Screening summary</h2>

                {!result && !error && (
                  <div className="matcher-empty-results">
                    Screening output appears here beside the inputs—run a screening to
                    see fit score, narrative summary, and skill alignment.
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
                        <span className="matcher-score-label">Role fit score</span>
                        <span className={`matcher-score-num ${getScoreClass(result.score)}`}>{result.score}%</span>
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
                            <h3>Reasons to advance</h3>
                            <ul>
                              {result.strengths.map((s, i) => (
                                <li key={`${i}-${s}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.gaps.length > 0 && (
                          <div className="matcher-mini">
                            <h3>Gaps vs. role</h3>
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
                            <h3>Hiring risks</h3>
                            <ul>
                              {result.riskFlags.map((s, i) => (
                                <li key={`risk-${i}-${s}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.interviewQuestions.length > 0 && (
                          <div className="matcher-mini">
                            <h3>Suggested interview probes</h3>
                            <ul>
                              {result.interviewQuestions.map((s, i) => (
                                <li key={`iq-${i}-${s}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.improvementPlan.length > 0 && (
                          <div className="matcher-mini">
                            <h3>HR next steps</h3>
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
                        <h3>Aligned with JD ({result.matchedSkills.length})</h3>
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
                        <h3>Missing or weak vs. JD ({result.missingSkills.length})</h3>
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
                    <div className="pipeline-shortcut-group">
                      <button
                        className="matcher-submit btn-pipeline-shortcut"
                        disabled={addingId === "screening"}
                        onClick={() => addToPipeline("Candidate", "Screened Role", result.score, result.summary, "screening")}
                      >
                        {addingId === "screening" ? "⏳ Adding..." : "🚀 Add to Pipeline"}
                      </button>
                      <button
                        className="btn-reject-shortcut"
                        disabled={addingId === "screening-reject"}
                        onClick={() => addToPipeline("Candidate", "Screened Role", result.score, result.summary, "screening-reject", "rejected")}
                      >
                        {addingId === "screening-reject" ? "⏳" : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      ) : activeSection === "rolefit" ? (
        <section className="glass-shell">
          <div className="matcher-grid">
            <section className="matcher-card matcher-rolefit-section">
              <h2><span>🎯</span> Best-fit role finder</h2>
              <p className="matcher-rolefit-note">
                Upload only the resume. AI predicts top-fit job roles, score and HR
                analysis.
              </p>

              <form className="matcher-form" onSubmit={handleRoleFitSubmit}>
                <div>
                  <label className="matcher-label" htmlFor="roleFitResume">
                    Candidate resume (PDF or DOCX)
                  </label>
                  <input
                    key="role-fit-resume"
                    id="roleFitResume"
                    name="roleFitResume"
                    type="file"
                    className="matcher-input-file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={roleLoading}
                    onChange={(ev) => {
                      setRoleFile(ev.target.files?.[0] ?? null);
                      setRoleError(null);
                      setRoleResult(null);
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="matcher-submit"
                  disabled={roleLoading}
                >
                  {roleLoading ? "Analyzing role fit…" : "Find best-fit roles"}
                </button>
              </form>

              {roleError && (
                <div className="matcher-alert" role="alert">
                  {roleError}
                </div>
              )}
            </section>

            <div className="matcher-results-wrap">
              <section
                className={`matcher-card ${roleResult ? "matcher-results-sticky" : ""}`}
              >
                <h2><span>🔍</span> Role-fit summary</h2>

                {!roleResult && !roleError && (
                  <div className="matcher-empty-results">
                    Upload a resume and run role-fit to see top matching roles,
                    scores, strengths, and concerns.
                  </div>
                )}

                {roleResult && (
                  <div className="matcher-results-body matcher-rolefit-results">
                    <div className="matcher-score-row">
                      <div className="matcher-score-badge">
                        <span className="matcher-score-label">Best-fit role</span>
                        <span className="matcher-role-title">{roleResult.bestFitRole}</span>
                      </div>
                      <span className={`matcher-rec ${getScoreClass(roleResult.bestFitScore)}`}>
                        {roleResult.bestFitScore}%
                      </span>
                    </div>

                    {roleResult.summary ? (
                      <p className="matcher-summary">{roleResult.summary}</p>
                    ) : null}

                    <div className="matcher-lists-row">
                      <div className="matcher-mini">
                        <h3>Top role matches</h3>
                        <ul>
                          {roleResult.roleMatches.map((item, i) => (
                            <li key={`${item.role}-${i}`}>
                              <strong>{item.role}</strong> (<span className={getScoreClass(item.score)}>{item.score}%</span>): {item.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="matcher-mini">
                        <h3>Recommended departments</h3>
                        <div className="matcher-chip-scroll">
                          {roleResult.recommendedDepartments.length === 0 ? (
                            <p className="matcher-placeholder">None listed</p>
                          ) : (
                            roleResult.recommendedDepartments.map((d) => (
                              <span key={d} className="matcher-chip matcher-chip-match">
                                {d}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="matcher-lists-row">
                      <div className="matcher-mini">
                        <h3>Profile strengths</h3>
                        <ul>
                          {roleResult.strengths.map((s, i) => (
                            <li key={`${s}-${i}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="matcher-mini">
                        <h3>Hiring concerns</h3>
                        <ul>
                          {roleResult.concerns.map((s, i) => (
                            <li key={`${s}-${i}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="pipeline-shortcut-group">
                      <button
                        className="matcher-submit btn-pipeline-shortcut"
                        disabled={addingId === "rolefit"}
                        onClick={() => addToPipeline("Candidate", roleResult.bestFitRole, roleResult.bestFitScore, roleResult.summary, "rolefit")}
                      >
                        {addingId === "rolefit" ? "⏳ Adding..." : "🚀 Add to Pipeline"}
                      </button>
                      <button
                        className="btn-reject-shortcut"
                        disabled={addingId === "rolefit-reject"}
                        onClick={() => addToPipeline("Candidate", roleResult.bestFitRole, roleResult.bestFitScore, roleResult.summary, "rolefit-reject", "rejected")}
                      >
                        {addingId === "rolefit-reject" ? "⏳" : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      ) : activeSection === "pipeline" ? (
        <section className="pipeline-board">
          {PIPELINE_STAGES.map((stage) => {
            const items = pipelineItems
              .filter((i) => i.stage === stage.id)
              .sort((a, b) => b.score - a.score);
            return (
              <div key={stage.id} className="pipeline-column">
                <div className="pipeline-stage-header">
                  <span className="stage-icon">{stage.icon}</span>
                  <div className="stage-info">
                    <h3>{stage.name}</h3>
                    <span className="item-count">{items.length} candidates</span>
                  </div>
                </div>
                
                <div className="pipeline-items-list">
                  {items.length === 0 ? (
                    <div className="pipeline-empty">No candidates</div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="pipeline-card">
                        <div className="pipeline-card-header">
                          <span className="candidate-name">{item.name}</span>
                          <span className="candidate-score">{item.score}%</span>
                        </div>
                        <div className="candidate-role">{item.role}</div>
                        <p className="candidate-summary">{item.summary}</p>
                        
                        <div className="pipeline-actions">
                          <select 
                            value={item.stage || ""} 
                            onChange={(e) => updateStage(item.id, e.target.value)}
                            className="stage-select"
                          >
                            {PIPELINE_STAGES.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button 
                            className="btn-delete-item"
                            onClick={() => deletePipelineItem(item.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : activeSection === "comparison" ? (
        <section className="glass-shell">
          <div className="comparison-layout">
            {comparisonResult.length === 0 ? (
              <div className="matcher-card comparison-input-card">
                <h2><span>📊</span> Multi-Candidate Comparison</h2>
                <p className="matcher-welcome">Upload 2+ resumes to compare against one JD.</p>
                
                <form className="matcher-form" onSubmit={handleComparisonSubmit}>
                  <div>
                    <label className="matcher-label">Resumes (Select Multiple)</label>
                    <input 
                      key="comparison-files-input"
                      type="file" 
                      multiple 
                      className="matcher-input-file"
                      onChange={(e) => setComparisonFiles(Array.from(e.target.files || []))}
                    />
                  </div>
                  <div>
                    <label className="matcher-label">Job Description</label>
                    <textarea 
                      className="matcher-textarea" 
                      rows={6}
                      value={comparisonJobDesc || ""}
                      onChange={(e) => setComparisonJobDesc(e.target.value)}
                      placeholder="Paste the job description here..."
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="matcher-submit" 
                    disabled={comparisonLoading}
                  >
                    {comparisonLoading ? "Running Matrix Analysis..." : "Generate Comparison Matrix"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="matcher-card comparison-results-card">
                <div className="comparison-header">
                  <h2><span>✅</span> Comparison Results</h2>
                  <button 
                    className="btn-logout" 
                    onClick={() => {
                      setComparisonResult([]);
                      setComparisonFiles([]);
                    }}
                  >
                    🔄 Start New Comparison
                  </button>
                </div>
                
                <div className="comparison-table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {comparisonResult.map((res, i) => (
                          <th key={i}>{res.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Match Score</td>
                        {comparisonResult.map((res, i) => (
                          <td key={i}><span className={`comparison-score ${getScoreClass(res.score)}`}>{res.score}%</span></td>
                        ))}
                      </tr>
                      <tr>
                        <td>Recommendation</td>
                        {comparisonResult.map((res, i) => (
                          <td key={i} className="comparison-rec">{res.recommendation}</td>
                        ))}
                      </tr>
                      <tr>
                        <td>Top Strengths</td>
                        {comparisonResult.map((res, i) => (
                          <td key={i}>
                            <ul className="comparison-list">
                              {res.strengths.slice(0, 3).map((s: string, j: number) => <li key={j}>{s}</li>)}
                            </ul>
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td>Action</td>
                        {comparisonResult.map((res, i) => (
                          <td key={i}>
                            <div className="action-cell-stack">
                              <button 
                                className="matcher-submit btn-mini"
                                disabled={addingId === `comp-${i}`}
                                onClick={() => addToPipeline(res.name, "Compared Candidate", res.score, res.summary, `comp-${i}`)}
                              >
                                {addingId === `comp-${i}` ? "⏳" : "Add"}
                              </button>
                              <button 
                                className="btn-reject-shortcut btn-mini"
                                disabled={addingId === `comp-rej-${i}`}
                                onClick={() => addToPipeline(res.name, "Compared Candidate", res.score, res.summary, `comp-rej-${i}`, "rejected")}
                              >
                                {addingId === `comp-rej-${i}` ? "⏳" : "Reject"}
                              </button>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : activeSection === "peer-ranking" ? (
        <section className="glass-shell">
          <div className="comparison-layout">
            {!peerRankResult ? (
              <div className="matcher-card comparison-input-card">
                <h2><span>⚖️</span> Peer Ranking Arbitrator</h2>
                <p className="matcher-welcome">Compare candidates directly to find the strongest one.</p>
                
                <form className="matcher-form" onSubmit={handlePeerRankSubmit}>
                  <div>
                    <label className="matcher-label">Target Role Title (e.g. Sales Executive)</label>
                    <input 
                      type="text" 
                      className="matcher-textarea" 
                      style={{ height: 'auto' }}
                      value={peerRankRole || ""}
                      onChange={(e) => setPeerRankRole(e.target.value)}
                      placeholder="Enter role title..."
                    />
                  </div>
                  <div>
                    <label className="matcher-label">Candidate Resumes (Select 2+)</label>
                    <input 
                      key="peer-rank-files-input"
                      type="file" 
                      multiple 
                      className="matcher-input-file"
                      onChange={(e) => setPeerRankFiles(Array.from(e.target.files || []))}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="matcher-submit" 
                    disabled={peerRankLoading}
                  >
                    {peerRankLoading ? "Arbitrating Candidates..." : "Run Peer Ranking"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="matcher-card comparison-results-card">
                <div className="comparison-header">
                  <h2><span>🏆</span> Winner: {peerRankResult.overallWinner}</h2>
                  <button 
                    className="btn-logout" 
                    onClick={() => {
                      setPeerRankResult(null);
                      setPeerRankFiles([]);
                    }}
                  >
                    🔄 New Arbitration
                  </button>
                </div>
                
                <p className="matcher-summary" style={{ marginBottom: '2rem' }}>{peerRankResult.summary}</p>

                <div className="comparison-table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Candidate</th>
                        <th>Intelligence</th>
                        <th>Fit Score</th>
                        <th>AI Verdict</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peerRankResult.rankings.map((res: any, i: number) => (
                        <tr key={i} style={res.rank === 1 ? { background: 'var(--accent-soft)' } : {}}>
                          <td><strong>#{res.rank}</strong></td>
                          <td>{res.name}</td>
                          <td><span className={`comparison-score ${getScoreClass(res.intelligenceScore)}`}>{res.intelligenceScore}</span></td>
                          <td><span className={`comparison-score ${getScoreClass(res.fitScore)}`}>{res.fitScore}</span></td>
                          <td style={{ fontSize: '0.85rem' }}>{res.verdict}</td>
                          <td>
                            <div className="action-cell-stack">
                              <button 
                                className="matcher-submit btn-mini"
                                disabled={addingId === `peer-${i}`}
                                onClick={() => addToPipeline(res.name, peerRankRole, res.fitScore, res.verdict, `peer-${i}`)}
                              >
                                {addingId === `peer-${i}` ? "⏳" : "Add"}
                              </button>
                              <button 
                                className="btn-reject-shortcut btn-mini"
                                disabled={addingId === `peer-rej-${i}`}
                                onClick={() => addToPipeline(res.name, peerRankRole, res.fitScore, res.verdict, `peer-rej-${i}`, "rejected")}
                              >
                                {addingId === `peer-rej-${i}` ? "⏳" : "Reject"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : activeSection === "analytics" ? (
        <section className="glass-shell analytics-container">
          <AnalyticsDashboard items={pipelineItems} />
        </section>
      ) : (
        <section className="glass-shell profiles-container">
          <div className="matcher-card profiles-add-card">
            <h2><span>➕</span> Add new profile link</h2>
            <form className="matcher-form" onSubmit={addProfileLink}>
              <div className="platform-selector">
                <label className="matcher-label">Select Platform</label>
                <div className="platform-chips">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`platform-chip platform-${p.id} ${newPlatform === p.id ? "active" : ""}`}
                      onClick={() => setNewPlatform(p.id)}
                    >
                      <span className="chip-icon">{p.icon}</span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <input
                  type="text"
                  placeholder="Profile URL (e.g. linkedin.com/in/user)"
                  value={newUrl || ""}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={newLabel || ""}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
                <button type="submit" className="btn-add-link">
                  Save Link
                </button>
              </div>
            </form>
          </div>

          <div className="profiles-grid">
            {PLATFORMS.map((platform) => {
              const platformLinks = profiles.filter(
                (p) => p.platform === platform.id
              );
              return (
                <div
                  key={platform.id}
                  className={`platform-card platform-${platform.id}`}
                >
                  <div className="platform-header">
                    <span className="platform-name">
                      <span className="platform-icon">{platform.icon}</span>
                      {platform.name}
                    </span>
                    {platformLinks.length > 0 && (
                      <span className="matcher-rec matcher-rec-strong">
                        {platformLinks.length} saved
                      </span>
                    )}
                  </div>

                  <div className="links-list">
                    {platformLinks.length === 0 ? (
                      <div className="empty-state">No {platform.name} links saved</div>
                    ) : (
                      platformLinks.map((link) => (
                        <div key={link.id} className="link-item">
                          <span className="link-text" title={link.url}>
                            {link.label}
                          </span>
                          <div className="link-actions">
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => window.open(link.url, "_blank")}
                              title="Open in new tab"
                            >
                              ↗
                            </button>
                            <button
                              type="button"
                              className="btn-icon delete"
                              onClick={() => deleteLink(link.id)}
                              title="Delete"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {platformLinks.length > 1 && (
                    <div className="platform-actions">
                      <button
                        className="btn-open-all"
                        onClick={() => openAll(platform.id)}
                      >
                        Open All ({platformLinks.length})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
