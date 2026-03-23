import axios from "axios";

export const EMBEDDING_DIM = 1024;
type Provider = "voyage" | "openai";

const provider = (): Provider =>
  (process.env.EMBEDDING_PROVIDER as Provider | undefined) ?? "voyage";

// ─── Voyage AI ────────────────────────────────────────────────────────────────
// Model: voyage-code-3  (1024 dims, optimised for code)
async function embedVoyage(texts: string[]): Promise<number[][]> {
  const { data } = await axios.post(
    "https://api.voyageai.com/v1/embeddings",
    {
      model: "voyage-code-3",
      input: texts,
      input_type: "document",
      output_dimension: EMBEDDING_DIM,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  // Response: { data: [{ embedding: number[], index: number }] }
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
// Model: text-embedding-3-small  (1024 dims via `dimensions` param)
async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const { data } = await axios.post(
    "https://api.openai.com/v1/embeddings",
    {
      model: "text-embedding-3-small",
      input: texts,
      dimensions: EMBEDDING_DIM,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

/**
 * Embed a batch of texts. Returns one vector per input text.
 * Provider is selected via EMBEDDING_PROVIDER env var ("voyage" | "openai").
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  switch (provider()) {
    case "openai":
      return embedOpenAI(texts);
    case "voyage":
    default:
      return embedVoyage(texts);
  }
}

/** Embed a single text. */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}
