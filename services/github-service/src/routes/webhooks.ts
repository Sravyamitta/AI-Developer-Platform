import { Router } from "express";
import axios from "axios";
import { db } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const webhooksRouter = Router();

// POST /api/github/repos/:owner/:repo/webhook
// Registers a GitHub webhook for the given repo
webhooksRouter.post("/:owner/:repo/webhook", requireAuth, async (req: AuthRequest, res) => {
  const { owner, repo } = req.params;

  try {
    const result = await db.query("SELECT access_token FROM users WHERE id=$1", [req.user!.id]);
    const { access_token } = result.rows[0];

    const webhookUrl = `${process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_API_URL}/api/github/webhook`;

    const { data } = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: "web",
        active: true,
        events: ["push", "pull_request"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: process.env.GITHUB_WEBHOOK_SECRET,
          insecure_ssl: "0",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    res.json({ hookId: data.id, url: data.config.url, events: data.events });
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.message;

    if (status === 422 && msg?.includes("already exists")) {
      res.json({ message: "Webhook already registered for this repo." });
      return;
    }

    console.error("Webhook registration error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

// GET /api/github/repos/:owner/:repo/webhook
// Lists webhooks for the given repo
webhooksRouter.get("/:owner/:repo/webhook", requireAuth, async (req: AuthRequest, res) => {
  const { owner, repo } = req.params;

  try {
    const result = await db.query("SELECT access_token FROM users WHERE id=$1", [req.user!.id]);
    const { access_token } = result.rows[0];

    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to list webhooks" });
  }
});
