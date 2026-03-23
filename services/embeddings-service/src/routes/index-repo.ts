import { Router } from "express";
import { db } from "../db";
import { chunkFile } from "../chunker";
import { embedAll, BatchItem } from "../batcher";

export const indexRouter = Router();

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".cpp", ".c", ".cs", ".php", ".swift", ".kt",
]);

function ext(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

interface FilePayload {
  path: string;
  content: string;
}

// POST /api/embeddings/index
// Body: { repoFullName, files[], userId? }
indexRouter.post("/", async (req, res) => {
  const {
    repoFullName,
    files,
    userId,
  }: { repoFullName: string; files: FilePayload[]; userId?: number } = req.body;

  if (!repoFullName || !Array.isArray(files)) {
    res.status(400).json({ error: "repoFullName and files[] are required" });
    return;
  }

  // Mark as indexing in DB
  await db
    .query(
      `INSERT INTO indexed_repos (user_id, repo_full_name, status)
       VALUES ($1, $2, 'indexing')
       ON CONFLICT (user_id, repo_full_name)
       DO UPDATE SET status='indexing', error_message=NULL`,
      [userId ?? null, repoFullName]
    )
    .catch(() => {}); // non-fatal if user_id FK fails

  // Acknowledge immediately — indexing continues async
  res.json({ message: "Indexing started", repo: repoFullName });

  // ─── Async indexing ───────────────────────────────────────────────────────
  setImmediate(async () => {
    try {
      const codeFiles = files.filter((f) => CODE_EXTENSIONS.has(ext(f.path)));

      // Build chunk list
      const items: BatchItem[] = [];
      for (const file of codeFiles) {
        const chunks = chunkFile(file.content);
        for (const chunk of chunks) {
          items.push({
            text: `// ${file.path}\n${chunk.content}`,
            meta: {
              filePath: file.path,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              content: chunk.content,
              symbolNames: chunk.symbolNames,
            },
          });
        }
      }

      if (items.length === 0) {
        await db.query(
          `UPDATE indexed_repos SET status='ready', file_count=0, chunk_count=0, indexed_at=NOW()
           WHERE repo_full_name=$1`,
          [repoFullName]
        );
        return;
      }

      // Embed all chunks in batches
      const results = await embedAll(items);

      // Delete old embeddings and bulk insert new ones
      await db.query("DELETE FROM code_embeddings WHERE repo_full_name=$1", [repoFullName]);

      // Insert in DB batches of 100
      for (let i = 0; i < results.length; i += 100) {
        const slice = results.slice(i, i + 100);

        // Build parameterized INSERT
        const values: unknown[] = [];
        const placeholders = slice.map((r, j) => {
          const base = j * 6;
          const m = r.meta as {
            filePath: string; startLine: number; endLine: number;
            content: string; symbolNames: string[];
          };
          values.push(
            repoFullName, m.filePath, m.startLine, m.endLine,
            m.content, `[${r.embedding.join(",")}]`
          );
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6}::vector)`;
        });

        await db.query(
          `INSERT INTO code_embeddings
             (repo_full_name, file_path, start_line, end_line, content, embedding)
           VALUES ${placeholders.join(",")}`,
          values
        );
      }

      // Update symbol_names separately (array type is easier this way)
      for (const r of results) {
        const m = r.meta as { filePath: string; startLine: number; symbolNames: string[] };
        if (m.symbolNames.length > 0) {
          await db.query(
            `UPDATE code_embeddings SET symbol_names=$1
             WHERE repo_full_name=$2 AND file_path=$3 AND start_line=$4`,
            [m.symbolNames, repoFullName, m.filePath, m.startLine]
          );
        }
      }

      await db.query(
        `UPDATE indexed_repos
         SET status='ready', file_count=$1, chunk_count=$2, indexed_at=NOW()
         WHERE repo_full_name=$3`,
        [codeFiles.length, results.length, repoFullName]
      );

      console.log(`[embeddings] Indexed ${repoFullName}: ${codeFiles.length} files, ${results.length} chunks`);
    } catch (err: any) {
      console.error("[embeddings] Indexing failed:", err.message);
      await db.query(
        `UPDATE indexed_repos SET status='failed', error_message=$1 WHERE repo_full_name=$2`,
        [err.message ?? "Unknown error", repoFullName]
      );
    }
  });
});

// GET /api/embeddings/index/status?repo=owner/name
indexRouter.get("/status", async (req, res) => {
  const { repo } = req.query;
  if (!repo) { res.status(400).json({ error: "repo query param required" }); return; }

  const result = await db.query(
    `SELECT status, file_count, chunk_count, indexed_at, error_message
     FROM indexed_repos WHERE repo_full_name=$1
     ORDER BY created_at DESC LIMIT 1`,
    [repo]
  );
  res.json(result.rows[0] ?? { status: "not_indexed" });
});
