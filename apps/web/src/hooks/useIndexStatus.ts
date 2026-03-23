"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";

export type IndexStatus = "not_indexed" | "pending" | "indexing" | "ready" | "failed";

interface IndexState {
  status: IndexStatus;
  fileCount?: number;
  chunkCount?: number;
  indexedAt?: string;
  errorMessage?: string;
}

/** Polls /api/embeddings/index/status until the repo is ready or failed. */
export function useIndexStatus(repoFullName: string) {
  const [state, setState] = useState<IndexState>({ status: "not_indexed" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchStatus = async () => {
    try {
      const { data } = await api.get(
        `/api/embeddings/index/status?repo=${encodeURIComponent(repoFullName)}`
      );
      setState(data);
      if (data.status !== "indexing" && data.status !== "pending") {
        stopPolling();
      }
    } catch {
      // ignore transient errors
    }
  };

  useEffect(() => {
    fetchStatus();
    return stopPolling;
  }, [repoFullName]);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(fetchStatus, 2500);
  };

  return { state, startPolling, refetch: fetchStatus };
}
