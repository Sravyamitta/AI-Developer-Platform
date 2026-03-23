"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStream } from "@/hooks/useStream";
import Navbar from "@/components/Navbar";
import IndexBanner from "@/components/IndexBanner";
import Link from "next/link";

type Tab = "review" | "explain" | "docs" | "qa";

export default function RepoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params   = useParams();
  const owner    = params.owner as string;
  const repo     = params.repo as string;
  const fullName = `${owner}/${repo}`;

  const [activeTab, setActiveTab] = useState<Tab>("review");

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "review",  label: "Code Review" },
    { id: "explain", label: "Explain / Debug" },
    { id: "docs",    label: "Generate Docs" },
    { id: "qa",      label: "Ask Codebase" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-gray-300">Repositories</Link>
          <span>/</span>
          <span className="text-gray-200">{fullName}</span>
        </div>

        <IndexBanner owner={owner} repo={repo} fullName={fullName} />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "review"  && <ReviewPanel />}
        {activeTab === "explain" && <ExplainPanel />}
        {activeTab === "docs"    && <DocsPanel />}
        {activeTab === "qa"      && <QAPanel fullName={fullName} />}
      </main>
    </div>
  );
}

// ─── Review Panel ─────────────────────────────────────────────────────────────
function ReviewPanel() {
  const [diff, setDiff]         = useState("");
  const [filename, setFilename] = useState("");
  const { text, loading, cached, error, run, reset } = useStream();

  return (
    <div className="space-y-4">
      <input className="input-base" placeholder="Filename (e.g. src/auth/login.ts)"
        value={filename} onChange={(e) => { setFilename(e.target.value); reset(); }} />
      <textarea className="textarea-base font-mono h-52" placeholder="Paste your git diff here..."
        value={diff} onChange={(e) => { setDiff(e.target.value); reset(); }} />
      <button onClick={() => run("/api/ai/review", { diff, filename })}
        disabled={loading || !diff.trim() || !filename.trim()} className="btn-primary">
        {loading ? "Reviewing..." : "Review Code"}
      </button>
      <ResultBox text={text} loading={loading} cached={cached} error={error} />
    </div>
  );
}

// ─── Explain Panel ────────────────────────────────────────────────────────────
function ExplainPanel() {
  const [code, setCode]         = useState("");
  const [filename, setFilename] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { text, loading, cached, error, run, reset } = useStream();

  return (
    <div className="space-y-4">
      <input className="input-base" placeholder="Filename"
        value={filename} onChange={(e) => { setFilename(e.target.value); reset(); }} />
      <textarea className="textarea-base font-mono h-52" placeholder="Paste code to explain..."
        value={code} onChange={(e) => { setCode(e.target.value); reset(); }} />
      <input className="input-base"
        placeholder="Error message (optional — switches to bug mode)"
        value={errorMsg} onChange={(e) => { setErrorMsg(e.target.value); reset(); }} />
      <button
        onClick={() => run("/api/ai/explain", {
          code, filename, ...(errorMsg.trim() ? { errorMessage: errorMsg } : {}),
        })}
        disabled={loading || !code.trim() || !filename.trim()} className="btn-primary">
        {loading ? "Explaining..." : errorMsg ? "Explain Bug" : "Explain Code"}
      </button>
      <ResultBox text={text} loading={loading} cached={cached} error={error} />
    </div>
  );
}

// ─── Docs Panel ───────────────────────────────────────────────────────────────
function DocsPanel() {
  const [code, setCode]         = useState("");
  const [filename, setFilename] = useState("");
  const [style, setStyle]       = useState<"markdown" | "jsdoc" | "inline">("markdown");
  const { text, loading, cached, error, run, reset } = useStream();

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input className="input-base flex-1" placeholder="Filename"
          value={filename} onChange={(e) => { setFilename(e.target.value); reset(); }} />
        <select value={style} onChange={(e) => { setStyle(e.target.value as any); reset(); }}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none focus:border-blue-500 text-sm">
          <option value="markdown">Markdown</option>
          <option value="jsdoc">JSDoc</option>
          <option value="inline">Inline</option>
        </select>
      </div>
      <textarea className="textarea-base font-mono h-52" placeholder="Paste code to document..."
        value={code} onChange={(e) => { setCode(e.target.value); reset(); }} />
      <button onClick={() => run("/api/ai/docs", { code, filename, style })}
        disabled={loading || !code.trim() || !filename.trim()} className="btn-primary">
        {loading ? "Generating..." : "Generate Docs"}
      </button>
      <ResultBox text={text} loading={loading} cached={cached} error={error} />
    </div>
  );
}

// ─── Q&A Panel ────────────────────────────────────────────────────────────────
function QAPanel({ fullName }: { fullName: string }) {
  const [question, setQuestion] = useState("");
  const [sources, setSources]   = useState<any[]>([]);

  const onSources = useCallback((s: unknown[]) => setSources(s as any[]), []);
  const { text, loading, cached, error, run, reset } = useStream({ onSources });

  const submit = () => {
    if (!question.trim()) return;
    setSources([]);
    run("/api/qa", { repoFullName: fullName, question });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input className="input-base flex-1"
          placeholder="Ask anything about this codebase..."
          value={question}
          onChange={(e) => { setQuestion(e.target.value); reset(); setSources([]); }}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button onClick={submit} disabled={loading || !question.trim()}
          className="btn-primary shrink-0">
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>

      <ResultBox text={text} loading={loading} cached={cached} error={error} />

      {sources.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs font-medium mb-2">Sources</p>
          <div className="space-y-1.5">
            {sources.map((s, i) => (
              <div key={i}
                className="flex items-center gap-3 text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded px-3 py-2">
                <span className="font-mono text-gray-300 truncate">{s.filePath}</span>
                <span className="text-gray-600 shrink-0">
                  lines {s.startLine}–{s.endLine}
                </span>
                <span className="ml-auto text-green-500 shrink-0">
                  {(s.similarity * 100).toFixed(0)}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Result Box ────────────────────────────────────────────────────────
function ResultBox({ text, loading, cached, error }: {
  text: string; loading: boolean; cached: boolean; error: string | null;
}) {
  if (!text && !loading && !error) return null;

  return (
    <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-5">
      {cached && (
        <span className="absolute top-3 right-3 text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">
          cached
        </span>
      )}
      {error
        ? <p className="text-red-400 text-sm">{error}</p>
        : (
          <pre className="text-gray-200 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {text}
            {loading && (
              <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />
            )}
          </pre>
        )
      }
    </div>
  );
}
