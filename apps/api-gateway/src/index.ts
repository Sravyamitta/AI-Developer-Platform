import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_API_URL?.replace("3001", "3000") || "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// Proxy routes to services
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: `http://localhost:${process.env.GITHUB_SERVICE_PORT || 3002}`,
    changeOrigin: true,
  })
);

app.use(
  "/api/github",
  createProxyMiddleware({
    target: `http://localhost:${process.env.GITHUB_SERVICE_PORT || 3002}`,
    changeOrigin: true,
  })
);

app.use(
  "/api/ai",
  createProxyMiddleware({
    target: `http://localhost:${process.env.AI_SERVICE_PORT || 3003}`,
    changeOrigin: true,
  })
);

app.use(
  "/api/embeddings",
  createProxyMiddleware({
    target: `http://localhost:${process.env.EMBEDDINGS_SERVICE_PORT || 3004}`,
    changeOrigin: true,
  })
);

app.use(
  "/api/qa",
  createProxyMiddleware({
    target: `http://localhost:${process.env.REPO_QA_SERVICE_PORT || 3005}`,
    changeOrigin: true,
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

export default app;
