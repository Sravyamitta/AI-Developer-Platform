const RETRYABLE_MESSAGES = ["429", "500", "502", "503", "quota"];

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg: string = err?.message ?? "";
      const isRetryable = RETRYABLE_MESSAGES.some((s) => msg.includes(s));

      if (isRetryable) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }

  throw lastErr;
}
