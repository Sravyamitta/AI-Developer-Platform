import Anthropic from "@anthropic-ai/sdk";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

/** Call fn with exponential backoff on rate-limit / server errors. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const status =
        err instanceof Anthropic.APIError ? err.status : undefined;

      if (status && RETRYABLE_STATUSES.has(status)) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`Attempt ${attempt} failed (${status}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        // Non-retryable error — throw immediately
        throw err;
      }
    }
  }

  throw lastErr;
}
