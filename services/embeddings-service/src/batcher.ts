import { embedBatch } from "./embedder";

export interface BatchItem {
  text: string;
  meta: Record<string, unknown>;
}

export interface BatchResult {
  embedding: number[];
  meta: Record<string, unknown>;
}

const BATCH_SIZE      = 32;   // max texts per API call
const RATE_LIMIT_MS   = 200;  // min ms between batches (5 req/s conservative)
const MAX_TEXT_CHARS  = 8000; // truncate inputs over this length

function truncate(text: string): string {
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Embed a large list of items in batches with rate limiting.
 * On failure, retries once with a 2-second delay before giving up.
 */
export async function embedAll(items: BatchItem[]): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const texts = batch.map((b) => truncate(b.text));

    let embeddings: number[][];
    try {
      embeddings = await embedBatch(texts);
    } catch (err: any) {
      // One retry on rate-limit or transient error
      if (err?.response?.status === 429 || err?.response?.status >= 500) {
        console.warn(`Batch ${i / BATCH_SIZE + 1} failed (${err.response?.status}), retrying in 2s…`);
        await sleep(2000);
        embeddings = await embedBatch(texts);
      } else {
        throw err;
      }
    }

    for (let j = 0; j < batch.length; j++) {
      results.push({ embedding: embeddings[j], meta: batch[j].meta });
    }

    // Respect rate limits between batches (skip delay after last batch)
    if (i + BATCH_SIZE < items.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  return results;
}
