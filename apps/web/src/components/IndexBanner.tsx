"use client";

import { useIndexStatus, IndexStatus } from "@/hooks/useIndexStatus";
import api from "@/lib/api";

const STATUS_LABEL: Record<IndexStatus, string> = {
  not_indexed: "Not indexed",
  pending:     "Queued...",
  indexing:    "Indexing...",
  ready:       "Indexed",
  failed:      "Indexing failed",
};

const STATUS_DOT: Record<IndexStatus, string> = {
  not_indexed: "bg-gray-600",
  pending:     "bg-yellow-400 animate-pulse",
  indexing:    "bg-blue-400 animate-pulse",
  ready:       "bg-green-500",
  failed:      "bg-red-500",
};

interface Props {
  owner: string;
  repo: string;
  fullName: string;
}

export default function IndexBanner({ owner, repo, fullName }: Props) {
  const { state, startPolling, refetch } = useIndexStatus(fullName);

  const handleIndex = async () => {
    try {
      const { data: tree } = await api.get(`/api/github/repos/${owner}/${repo}/tree`);
      const codeFiles = (tree as any[])
        .filter((f: any) => f.type === "blob" && /\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/.test(f.path))
        .slice(0, 200);

      const files: { path: string; content: string }[] = [];
      for (let i = 0; i < codeFiles.length; i += 10) {
        const batch = codeFiles.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map((f: any) =>
            api.get(`/api/github/repos/${owner}/${repo}/file?path=${encodeURIComponent(f.path)}`)
          )
        );
        for (const r of results) {
          if (r.status === "fulfilled")
            files.push({ path: r.value.data.path, content: r.value.data.content });
        }
      }

      await api.post("/api/embeddings/index", { repoFullName: fullName, files });
      startPolling(); // poll until status becomes ready/failed
    } catch (err) {
      console.error("Indexing failed:", err);
      refetch();
    }
  };

  const isActive = state.status === "indexing" || state.status === "pending";
  const canIndex = !isActive;

  return (
    <div className="border border-gray-800 bg-gray-900 rounded-lg px-5 py-4 flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[state.status]}`} />
        <div>
          <p className="text-gray-200 text-sm font-medium">
            {STATUS_LABEL[state.status]}
            {state.status === "ready" &&
              ` — ${state.fileCount} files, ${state.chunkCount} chunks`}
          </p>
          {state.status === "failed" && state.errorMessage && (
            <p className="text-red-400 text-xs mt-0.5">{state.errorMessage}</p>
          )}
          {state.status === "not_indexed" && (
            <p className="text-gray-500 text-xs mt-0.5">
              Index to enable Ask Codebase and richer AI context.
            </p>
          )}
          {state.status === "indexing" && (
            <p className="text-gray-500 text-xs mt-0.5">
              Embedding code chunks — this may take a minute...
            </p>
          )}
          {state.status === "ready" && state.indexedAt && (
            <p className="text-gray-500 text-xs mt-0.5">
              Last indexed {new Date(state.indexedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleIndex}
        disabled={!canIndex}
        className="btn-primary ml-4 shrink-0 disabled:cursor-not-allowed"
      >
        {isActive
          ? "Indexing..."
          : state.status === "ready"
          ? "Re-index"
          : "Index Repo"}
      </button>
    </div>
  );
}
