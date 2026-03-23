import { Router } from "express";
import { anthropic, MODEL } from "../claude";
import { hashInput, getCached, saveCache } from "../cache";
import { startSSE } from "../stream";
import { withRetry } from "../retry";

export const explainRouter = Router();

// POST /api/ai/explain
// Body: { code, filename, errorMessage?, stackTrace? }
explainRouter.post("/", async (req, res) => {
  const { code, filename, errorMessage, stackTrace } = req.body;

  if (!code || !filename) {
    res.status(400).json({ error: "code and filename are required" });
    return;
  }

  const { send, done, error } = startSSE(res);
  const isErrorMode = !!errorMessage;
  const cacheKey = hashInput("explain", { code, filename, errorMessage, stackTrace });

  const cached = await getCached(cacheKey).catch(() => null);
  if (cached) {
    send("cached", cached);
    done();
    return;
  }

  const prompt = isErrorMode
    ? `You are a debugging expert. Explain the following bug clearly.

File: ${filename}
Error: ${errorMessage}
${stackTrace ? `Stack trace:\n${stackTrace}\n` : ""}
Code:
\`\`\`
${code}
\`\`\`

Provide:
## Root Cause
## Explanation
## Fix`
    : `You are a senior engineer. Explain the following code clearly.

File: ${filename}
\`\`\`
${code}
\`\`\`

Provide:
## Purpose
## How it works
## Key patterns
## Potential concerns`;

  let fullText = "";

  try {
    await withRetry(async () => {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
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

    await saveCache("explain", cacheKey, fullText, MODEL).catch(() => {});
    done();
  } catch (err: any) {
    console.error("Explain stream error:", err);
    error(err?.message ?? "Failed to generate explanation");
  }
});
