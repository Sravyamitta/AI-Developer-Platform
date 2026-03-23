import { Router } from "express";
import { anthropic, MODEL } from "../claude";
import { hashInput, getCached, saveCache } from "../cache";
import { startSSE } from "../stream";
import { withRetry } from "../retry";

export const reviewRouter = Router();

const SYSTEM = `You are a senior software engineer performing a thorough code review.
Structure your response with these sections:
## Summary
## Issues
## Suggestions
## Verdict
Verdict must end with one of: APPROVE | REQUEST_CHANGES | COMMENT
Be specific, reference line numbers where relevant, and keep feedback actionable.`;

// POST /api/ai/review
// Body: { diff, filename, context? }
// Streams SSE events: chunk | cached | done | error
reviewRouter.post("/", async (req, res) => {
  const { diff, filename, context } = req.body;

  if (!diff || !filename) {
    res.status(400).json({ error: "diff and filename are required" });
    return;
  }

  const { send, done, error } = startSSE(res);
  const cacheKey = hashInput("review", { diff, filename, context });

  // Check cache first
  const cached = await getCached(cacheKey).catch(() => null);
  if (cached) {
    send("cached", cached);
    done();
    return;
  }

  const userContent = `File: ${filename}
${context ? `Context: ${context}\n` : ""}
Diff to review:
\`\`\`diff
${diff}
\`\`\``;

  let fullText = "";

  try {
    await withRetry(async () => {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          send("chunk", event.delta.text);
          fullText += event.delta.text;
        }
      }
    });

    await saveCache("review", cacheKey, fullText, MODEL).catch(() => {});
    done();
  } catch (err: any) {
    console.error("Review stream error:", err);
    error(err?.message ?? "Failed to generate code review");
  }
});
