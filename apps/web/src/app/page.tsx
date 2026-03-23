"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect already-logged-in users
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-bold text-white mb-4">AI Developer Platform</h1>
        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          Automate code review, explain bugs, generate documentation, and ask
          questions about any GitHub repository — powered by Claude.
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 mb-10">
          {[
            "Automated code review",
            "Bug explanation",
            "Docs generation",
            "Repo Q&A (RAG)",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-300">{f}</span>
            </div>
          ))}
        </div>

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`}
          className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition text-sm"
        >
          <svg viewBox="0 0 16 16" className="w-5 h-5 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Connect GitHub
        </a>
      </div>
    </main>
  );
}
