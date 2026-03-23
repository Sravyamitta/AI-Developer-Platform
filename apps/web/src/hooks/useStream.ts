"use client";

import { useState, useCallback } from "react";

interface UseStreamOptions {
  onSources?: (sources: unknown[]) => void;
  onDone?: (fullText: string) => void;
}

export function useStream({ onSources, onDone }: UseStreamOptions = {}) {
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [cached, setCached]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const run = useCallback(
    async (url: string, body: object) => {
      setText("");
      setError(null);
      setCached(false);
      setLoading(true);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}${url}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          setError(err.error ?? "Request failed");
          return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full   = "";
        let currentEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              continue;
            }

            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (payload === "{}") continue;

              try {
                const parsed = JSON.parse(payload);

                if (currentEvent === "cached") {
                  setCached(true);
                  setText(parsed as string);
                  full = parsed as string;
                } else if (currentEvent === "chunk") {
                  const chunk = parsed as string;
                  full += chunk;
                  setText((prev) => prev + chunk);
                } else if (currentEvent === "sources") {
                  onSources?.(parsed as unknown[]);
                } else if (currentEvent === "error") {
                  setError(parsed as string);
                }
              } catch {
                // malformed line — skip
              }

              currentEvent = "";
            }
          }
        }

        onDone?.(full);
      } catch (err: any) {
        setError(err?.message ?? "Network error");
      } finally {
        setLoading(false);
      }
    },
    [onSources, onDone]
  );

  const reset = useCallback(() => {
    setText("");
    setError(null);
    setCached(false);
  }, []);

  return { text, loading, cached, error, run, reset };
}
