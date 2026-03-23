import { Router } from "express";
import { getModel, MODEL_NAME } from "../gemini";
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

    await saveCache("explain", cacheKey, fullText, MODEL_NAME).catch(() => {});
    done();
  } catch (err: any) {
    console.error("Explain stream error:", err);
    error(err?.message ?? "Failed to generate explanation");
  }
});
