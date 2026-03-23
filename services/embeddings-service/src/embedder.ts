import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini text-embedding-004 — free tier: 1500 RPM
export const EMBEDDING_DIM = 768;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const result = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { parts: [{ text }], role: "user" },
      taskType: "RETRIEVAL_DOCUMENT" as any,
    })),
  });

  return result.embeddings.map((e) => e.values);
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}
