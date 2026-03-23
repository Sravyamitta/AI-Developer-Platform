import { Router } from "express";
import { anthropic, MODEL } from "../claude";
import { hashInput, getCached, saveCache } from "../cache";
import { startSSE } from "../stream";
import { withRetry } from "../retry";

export const docsRouter = Router();

const STYLE_INSTRUCTIONS: Record<string, string> = {
  jsdoc:
    "Generate JSDoc comments for all functions, classes, and exported symbols. Return only the commented source code.",
  markdown:
    "Generate a Markdown documentation page with: Overview, Installation/Usage, API Reference (all exports with params + return types), and Examples.",
  inline:
    "Add concise inline comments throughout the code explaining non-obvious logic. Return the fully commented source code.",
};

// POST /api/ai/docs
// Body: { code, filename, style? }
docsRouter.post("/", async (req, res) => {
  const { code, filename, style = "markdown" } = req.body;

  if (!code || !filename) {
    res.status(400).json({ error: "code and filename are required" });
    return;
  }

  const { send, done, error } = startSSE(res);
  const cacheKey = hashInput("docs", { code, filename, style });

  const cached = await getCached(cacheKey).catch(() => null);
  if (cached) {
    send("cached", cached);
    done();
    return;
  }

  const instructions = STYLE_INSTRUCTIONS[style] ?? STYLE_INSTRUCTIONS.markdown;

  const prompt = `You are a technical writer generating documentation for source code.

File: ${filename}
Style: ${style}
Instructions: ${instructions}

Code:
\`\`\`
${code}
\`\`\`

Generate high-quality documentation. Be accurate, concise, and developer-friendly.`;

  let fullText = "";

  try {
    await withRetry(async () => {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 2048,
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

    await saveCache("docs", cacheKey, fullText, MODEL).catch(() => {});
    done();
  } catch (err: any) {
    console.error("Docs stream error:", err);
    error(err?.message ?? "Failed to generate documentation");
  }
});
