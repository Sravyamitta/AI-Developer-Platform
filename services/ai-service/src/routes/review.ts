import { Router } from "express";
import { getModel, MODEL_NAME } from "../gemini";
import { hashInput, getCached, saveCache } from "../cache";
import { startSSE } from "../stream";
import { withRetry } from "../retry";

export const reviewRouter = Router();

// POST /api/ai/review
// Body: { diff, filename, context? }
reviewRouter.post("/", async (req, res) => {
  const { diff, filename, context } = req.body;

  if (!diff || !filename) {
    res.status(400).json({ error: "diff and filename are required" });
    return;
  }

  const { send, done, error } = startSSE(res);
  const cacheKey = hashInput("review", { diff, filename, context });

  const cached = await getCached(cacheKey).catch(() => null);
  if (cached) {
    send("cached", cached);
    done();
    return;
  }

  const prompt = `You are a senior software engineer performing a thorough code review.

File: ${filename}
${context ? `Context: ${context}\n` : ""}
Diff to review:
\`\`\`diff
${diff}
\`\`\`

Provide a structured code review with these sections:
## Summary
## Issues
## Suggestions
## Verdict
Verdict must end with one of: APPROVE | REQUEST_CHANGES | COMMENT
Be specific, reference line numbers where relevant, and keep feedback actionable.`;

  let fullText = "";

  try {
    await withRetry(async () => {
      const model = getModel();
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          send("chunk", text);
          fullText += text;
        }
      }
    });

    await saveCache("review", cacheKey, fullText, MODEL_NAME).catch(() => {});
    done();
  } catch (err: any) {
    console.error("Review stream error:", err);
    error(err?.message ?? "Failed to generate code review");
  }
});
