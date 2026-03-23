"use client";

import Link from "next/link";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  updatedAt: string;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-400",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-400",
  Go: "bg-cyan-400",
  Rust: "bg-orange-500",
  Java: "bg-red-400",
  Ruby: "bg-red-500",
  "C++": "bg-pink-400",
};

export default function RepoCard({ repo }: { repo: Repo }) {
  const updated = new Date(repo.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="border border-gray-800 rounded-lg p-5 bg-gray-900 hover:border-gray-600 transition group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/repo/${repo.fullName}`}
            className="text-blue-400 font-medium hover:underline truncate block"
          >
            {repo.name}
          </Link>
          {repo.description && (
            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{repo.description}</p>
          )}
        </div>
        {repo.private && (
          <span className="shrink-0 text-xs border border-gray-600 text-gray-400 px-2 py-0.5 rounded-full">
            Private
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${LANG_COLORS[repo.language] || "bg-gray-400"}`}
            />
            {repo.language}
          </span>
        )}
        <span>★ {repo.stars}</span>
        <span>Updated {updated}</span>
      </div>
    </div>
  );
}
