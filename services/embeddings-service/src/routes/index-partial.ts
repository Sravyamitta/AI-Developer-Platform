import { Router } from "express";
import { db } from "../db";
import { chunkFile } from "../chunker";
import { embedAll, BatchItem } from "../batcher";

export const indexPartialRouter = Router();

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".cpp", ".c", ".cs", ".php", ".swift", ".kt",
]);

function ext(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot);
}

// POST /api/embeddings/index/partial
// Body: { repoFullName, files[] }
// Re-embeds only the given files, deleting their old chunks first.
indexPartialRouter.post("/", async (req, res) => {
  const { repoFullName, files }: { repoFullName: string; files: { path: string; content: string }[] } = req.body;

  if (!repoFullName || !Array.isArray(files)) {
    res.status(400).json({ error: "repoFullName and files[] are required" });
    return;
  }

  res.json({ message: "Partial re-index started", files: files.length });

  setImmediate(async () => {
    try {
      const codeFiles = files.filter((f) => CODE_EXTENSIONS.has(ext(f.path)));
      if (codeFiles.length === 0) return;

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

      if (items.length === 0) return;

      const results = await embedAll(items);

      // Delete old chunks for these specific files only
      for (const file of codeFiles) {
        await db.query(
          "DELETE FROM code_embeddings WHERE repo_full_name=$1 AND file_path=$2",
          [repoFullName, file.path]
        );
      }

      // Insert new chunks
      for (let i = 0; i < results.length; i += 100) {
        const slice = results.slice(i, i + 100);
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

      console.log(
        `[embeddings] Partial re-index of ${repoFullName}: ${codeFiles.length} files, ${results.length} chunks`
      );
    } catch (err: any) {
      console.error("[embeddings] Partial re-index failed:", err.message);
    }
  });
});
