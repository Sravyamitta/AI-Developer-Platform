import { Router } from "express";
import axios from "axios";
import { db } from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const reposRouter = Router();

// List authenticated user's repos from GitHub
reposRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await db.query(
      "SELECT access_token FROM users WHERE id=$1",
      [req.user!.id]
    );
    const { access_token } = result.rows[0];

    const { data } = await axios.get("https://api.github.com/user/repos", {
      headers: { Authorization: `Bearer ${access_token}` },
      params: { per_page: 100, sort: "updated", type: "all" },
    });

    const repos = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      language: r.language,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
      defaultBranch: r.default_branch,
    }));

    res.json(repos);
  } catch (err) {
    console.error("Repos fetch error:", err);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// Get a repo's file tree
reposRouter.get("/:owner/:repo/tree", requireAuth, async (req: AuthRequest, res) => {
  const { owner, repo } = req.params;

  try {
    const result = await db.query(
      "SELECT access_token FROM users WHERE id=$1",
      [req.user!.id]
    );
    const { access_token } = result.rows[0];

    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    res.json(data.tree);
  } catch (err) {
    console.error("Tree fetch error:", err);
    res.status(500).json({ error: "Failed to fetch repo tree" });
  }
});

// Get file contents
reposRouter.get("/:owner/:repo/file", requireAuth, async (req: AuthRequest, res) => {
  const { owner, repo } = req.params;
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    res.status(400).json({ error: "path query param required" });
    return;
  }

  try {
    const result = await db.query(
      "SELECT access_token FROM users WHERE id=$1",
      [req.user!.id]
    );
    const { access_token } = result.rows[0];

    const { data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    res.json({ path, content, sha: data.sha });
  } catch (err) {
    console.error("File fetch error:", err);
    res.status(500).json({ error: "Failed to fetch file" });
  }
});
