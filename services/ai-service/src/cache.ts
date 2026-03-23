import crypto from "crypto";
import { db } from "./db";

export function hashInput(type: string, input: object): string {
  return crypto
    .createHash("sha256")
    .update(type + JSON.stringify(input))
    .digest("hex");
}

export async function getCached(inputHash: string): Promise<string | null> {
  const result = await db.query(
    "SELECT result FROM ai_results WHERE input_hash = $1 ORDER BY created_at DESC LIMIT 1",
    [inputHash]
  );
  return result.rows[0]?.result ?? null;
}

export async function saveCache(
  type: string,
  inputHash: string,
  result: string,
  model: string,
  userId?: number
): Promise<void> {
  await db.query(
    `INSERT INTO ai_results (user_id, type, input_hash, result, model)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId ?? null, type, inputHash, result, model]
  );
}
