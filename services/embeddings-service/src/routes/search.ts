import { Router } from "express";
import { db } from "../db";
import { embedText } from "../embedder";

export const searchRouter = Router();

// POST /api/embeddings/search
// Body: { repoFullName, query, topK? }
searchRouter.post("/", async (req, res) => {
  const { repoFullName, query, topK = 6 } = req.body;

  if (!repoFullName || !query) {
    res.status(400).json({ error: "repoFullName and query are required" });
    return;
  }

  try {
    const queryVec = await embedText(query);
    const vecStr   = `[${queryVec.join(",")}]`;

    const result = await db.query(
      `SELECT file_path, start_line, end_line, content, symbol_names,
              1 - (embedding <=> $1::vector) AS similarity
       FROM code_embeddings
       WHERE repo_full_name = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vecStr, repoFullName, topK]
    );

    res.json({ results: result.rows, query, repo: repoFullName });
  } catch (err: any) {
    console.error("[embeddings] Search error:", err.message);
    res.status(500).json({ error: "Search failed", detail: err.message });
  }
});
