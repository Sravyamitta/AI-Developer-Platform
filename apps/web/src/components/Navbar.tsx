"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center justify-between">
      <Link href="/dashboard" className="text-white font-semibold text-lg tracking-tight">
        AI Dev Platform
      </Link>

      {user && (
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm transition">
            Repos
          </Link>
          <div className="flex items-center gap-3">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-gray-300 text-sm">{user.login}</span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-300 text-sm transition"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
