export interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
  symbolNames: string[]; // extracted function/class names in this chunk
}

// Patterns that mark the start of a logical unit in common languages
const SYMBOL_BOUNDARY = /^(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s*)?\(|def\s|func\s|fn\s|pub\s+fn\s|impl\s|type\s+\w+\s*(?:struct|interface|=))/;

// Patterns to extract symbol names from a line
const SYMBOL_EXTRACTORS: RegExp[] = [
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,           // JS/TS function
  /(?:export\s+)?class\s+(\w+)/,                            // JS/TS/Java class
  /const\s+(\w+)\s*=\s*(?:async\s*)?\(/,                   // JS/TS arrow fn
  /def\s+(\w+)/,                                            // Python
  /func\s+(\w+)/,                                           // Go
  /fn\s+(\w+)/,                                             // Rust
  /pub\s+fn\s+(\w+)/,                                       // Rust pub fn
  /impl\s+(\w+)/,                                           // Rust impl
  /type\s+(\w+)\s+(?:struct|interface)/,                    // Go struct/interface
];

const MAX_CHUNK_LINES = 80;
const MIN_CHUNK_LINES = 5;
const OVERLAP_LINES   = 8;

function extractSymbols(lines: string[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    for (const re of SYMBOL_EXTRACTORS) {
      const m = line.match(re);
      if (m?.[1]) names.push(m[1]);
    }
  }
  return [...new Set(names)];
}

/**
 * Split file content into overlapping chunks that prefer to break at
 * function/class boundaries rather than arbitrary line counts.
 */
export function chunkFile(content: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];

  if (lines.length <= MAX_CHUNK_LINES) {
    // Small file — single chunk
    const trimmed = content.trim();
    if (trimmed.length >= 20) {
      chunks.push({
        content: trimmed,
        startLine: 1,
        endLine: lines.length,
        symbolNames: extractSymbols(lines),
      });
    }
    return chunks;
  }

  // Find natural boundary positions (lines that start a new top-level symbol)
  const boundaries: number[] = [0];
  for (let i = 1; i < lines.length; i++) {
    if (SYMBOL_BOUNDARY.test(lines[i].trimStart())) {
      boundaries.push(i);
    }
  }
  boundaries.push(lines.length);

  // Group boundaries into chunks, respecting MAX_CHUNK_LINES
  let chunkStart = 0;

  while (chunkStart < lines.length) {
    let chunkEnd = chunkStart;

    // Advance through boundaries until we'd exceed MAX_CHUNK_LINES
    for (let bi = 1; bi < boundaries.length; bi++) {
      const candidateEnd = boundaries[bi];
      if (candidateEnd - chunkStart > MAX_CHUNK_LINES && chunkEnd > chunkStart) {
        break;
      }
      chunkEnd = candidateEnd;
      if (chunkEnd >= lines.length) break;
    }

    // If we made no progress (single symbol > MAX), hard-cut at MAX
    if (chunkEnd <= chunkStart) {
      chunkEnd = Math.min(chunkStart + MAX_CHUNK_LINES, lines.length);
    }

    const chunkLines = lines.slice(chunkStart, chunkEnd);
    const chunkContent = chunkLines.join("\n").trim();

    if (chunkContent.length >= 20 && chunkLines.length >= MIN_CHUNK_LINES) {
      chunks.push({
        content: chunkContent,
        startLine: chunkStart + 1,
        endLine: chunkEnd,
        symbolNames: extractSymbols(chunkLines),
      });
    }

    // Next chunk starts with OVERLAP_LINES back from chunkEnd
    chunkStart = Math.max(chunkEnd - OVERLAP_LINES, chunkStart + 1);
  }

  return chunks;
}
