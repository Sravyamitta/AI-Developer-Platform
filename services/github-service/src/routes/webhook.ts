import { Router, Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { db } from "../db";

export const webhookRouter = Router();

const EMBEDDINGS_URL = `http://localhost:${process.env.EMBEDDINGS_SERVICE_PORT || 3004}`;

function verifySignature(payload: Buffer, signature: string): boolean {
  const hmac = crypto
    .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");
  const expected = `sha256=${hmac}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

webhookRouter.post("/", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string;

  if (!signature || !verifySignature(req.body as Buffer, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event   = req.headers["x-github-event"] as string;
  const payload = JSON.parse((req.body as Buffer).toString());

  // Log to DB
  await db
    .query(
      `INSERT INTO webhook_events (repo_full_name, event_type, payload)
       VALUES ($1, $2, $3)`,
      [payload.repository?.full_name ?? "unknown", event, payload]
    )
    .catch(() => {});

  res.status(200).json({ received: true });

  // Handle asynchronously so GitHub doesn't time out
  setImmediate(() => {
    switch (event) {
      case "push":
        handlePush(payload);
        break;
      case "pull_request":
        handlePullRequest(payload);
        break;
      default:
        console.log(`[webhook] Unhandled event: ${event}`);
    }
  });
});

// ─── Push: re-index changed files ────────────────────────────────────────────
async function handlePush(payload: any) {
  const repoFullName: string = payload.repository?.full_name;
  if (!repoFullName) return;

  // Check if this repo is indexed
  const { rows } = await db.query(
    "SELECT status FROM indexed_repos WHERE repo_full_name=$1 LIMIT 1",
    [repoFullName]
  );
  if (rows.length === 0 || rows[0].status === "not_indexed") return;

  // Collect unique changed file paths from all commits
  const changedPaths = new Set<string>();
  for (const commit of payload.commits ?? []) {
    [...(commit.added ?? []), ...(commit.modified ?? [])].forEach((p: string) =>
      changedPaths.add(p)
    );
  }

  if (changedPaths.size === 0) return;

  // Look up a user who has access to this repo to get an access token
  const userResult = await db.query(
    `SELECT u.access_token FROM users u
     JOIN indexed_repos ir ON ir.user_id = u.id
     WHERE ir.repo_full_name=$1 LIMIT 1`,
    [repoFullName]
  );
  if (userResult.rows.length === 0) return;

  const { access_token } = userResult.rows[0];
  const [owner, repo] = repoFullName.split("/");

  console.log(`[webhook] Push to ${repoFullName}: re-indexing ${changedPaths.size} changed file(s)`);

  // Fetch changed files from GitHub
  const files: { path: string; content: string }[] = [];
  for (const path of changedPaths) {
    try {
      const { data } = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      files.push({ path, content });
    } catch (err: any) {
      console.warn(`[webhook] Could not fetch ${path}:`, err.message);
    }
  }

  if (files.length === 0) return;

  // Trigger partial re-index for just these files
  await axios
    .post(`${EMBEDDINGS_URL}/api/embeddings/index/partial`, {
      repoFullName,
      files,
    })
    .catch((err) => console.error("[webhook] Partial re-index failed:", err.message));
}

// ─── Pull Request: log for future AI review trigger ───────────────────────────
function handlePullRequest(payload: any) {
  const { action, pull_request, repository } = payload;
  console.log(`[webhook] PR ${action}: #${pull_request?.number} in ${repository?.full_name}`);
  // Future: trigger AI code review on opened/synchronize
}
