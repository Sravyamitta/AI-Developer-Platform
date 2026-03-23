import { Router, Request, Response } from "express";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const qaRouter = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = "gemini-1.5-flash";
const EMBEDDINGS_URL = `http://localhost:${process.env.EMBEDDINGS_SERVICE_PORT || 3004}`;

function startSSE(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const done = () => { res.write("event: done\ndata: {}\n\n"); res.end(); };
  const error = (msg: string) => { res.write(`event: error\ndata: ${JSON.stringify(msg)}\n\n`); res.end(); };

  return { send, done, error };
}

// POST /api/qa
// Body: { repoFullName, question }
qaRouter.post("/", async (req: Request, res: Response) => {
  const { repoFullName, question } = req.body;

  if (!repoFullName || !question) {
    res.status(400).json({ error: "repoFullName and question are required" });
    return;
  }

  const { send, done, error } = startSSE(res);

  try {
    // Step 1: Retrieve relevant code chunks via vector search
    const { data } = await axios.post(`${EMBEDDINGS_URL}/api/embeddings/search`, {
      repoFullName,
      query: question,
      topK: 6,
    });

    const chunks = data.results as {
      file_path: string;
      start_line: number;
      end_line: number;
      content: string;
      similarity: number;
    }[];

    if (chunks.length === 0) {
      send("chunk", "No indexed code found for this repository. Please index the repository first.");
      done();
      return;
    }

    // Step 2: Emit sources before streaming answer
    send("sources", chunks.map((c) => ({
      filePath: c.file_path,
      startLine: c.start_line,
      endLine: c.end_line,
      similarity: c.similarity,
    })));

    // Step 3: Build context
    const context = chunks
      .map((c) => `// File: ${c.file_path} (lines ${c.start_line}-${c.end_line})\n${c.content}`)
      .join("\n\n---\n\n");

    // Step 4: Stream answer from Gemini
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContentStream(
      `You are an expert developer assistant for the repository "${repoFullName}".

Use the following code context to answer the question. If the answer is not in the context, say so clearly.

--- CONTEXT ---
${context}
--- END CONTEXT ---

Question: ${question}

Provide a clear, accurate answer. Reference specific files and line numbers when relevant.`
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) send("chunk", text);
    }

    done();
  } catch (err: any) {
    console.error("QA stream error:", err);
    error(err?.message ?? "Failed to answer question");
  }
});
