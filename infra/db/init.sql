-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  github_id     TEXT UNIQUE NOT NULL,
  login         TEXT NOT NULL,
  name          TEXT,
  email         TEXT,
  avatar_url    TEXT,
  access_token  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexed repositories
CREATE TABLE IF NOT EXISTS indexed_repos (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES users(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'indexing', 'ready', 'failed')),
  file_count     INT DEFAULT 0,
  chunk_count    INT DEFAULT 0,
  error_message  TEXT,
  indexed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_full_name)
);

-- Code embeddings — 1024-dim (Voyage code-3 / OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS code_embeddings (
  id             BIGSERIAL PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  start_line     INT NOT NULL,
  end_line       INT NOT NULL,
  content        TEXT NOT NULL,
  symbol_names   TEXT[],        -- extracted function/class names in this chunk
  embedding      vector(1024),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for ANN search (cosine distance)
CREATE INDEX IF NOT EXISTS code_embeddings_embedding_idx
  ON code_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS code_embeddings_repo_idx
  ON code_embeddings (repo_full_name);

-- AI job result cache
CREATE TABLE IF NOT EXISTS ai_results (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('review', 'explain', 'docs', 'qa')),
  input_hash  TEXT NOT NULL,
  result      TEXT NOT NULL,
  model       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_results_hash_idx ON ai_results (input_hash);

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id             BIGSERIAL PRIMARY KEY,
  repo_full_name TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL,
  processed      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
