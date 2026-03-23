// User
export interface User {
  id: number;
  githubId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
}

// Repository
export interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  updatedAt: string;
  defaultBranch: string;
}

// Code Review
export interface ReviewRequest {
  diff: string;
  filename: string;
  context?: string;
}

export interface ReviewResponse {
  review: string;
  model: string;
  filename: string;
}

// Explain
export interface ExplainRequest {
  code: string;
  filename: string;
  errorMessage?: string;
  stackTrace?: string;
}

export interface ExplainResponse {
  explanation: string;
  model: string;
  filename: string;
  mode: "code" | "bug";
}

// Docs
export interface DocsRequest {
  code: string;
  filename: string;
  style?: "jsdoc" | "markdown" | "inline";
}

export interface DocsResponse {
  documentation: string;
  model: string;
  filename: string;
  style: string;
}

// Embeddings
export interface IndexRequest {
  repoFullName: string;
  files: { path: string; content: string }[];
}

export interface SearchResult {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  similarity: number;
}

// Q&A
export interface QARequest {
  repoFullName: string;
  question: string;
}

export interface QAResponse {
  answer: string;
  sources: Omit<SearchResult, "content">[];
}

// API error
export interface ApiError {
  error: string;
}
