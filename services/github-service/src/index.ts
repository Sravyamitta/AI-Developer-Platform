import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { reposRouter } from "./routes/repos";
import { webhookRouter } from "./routes/webhook";
import { webhooksRouter } from "./routes/webhooks";

const app = express();
const PORT = process.env.GITHUB_SERVICE_PORT || 3002;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
// Raw body needed for webhook signature verification
app.use("/api/github/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "github-service" });
});

app.use("/api/auth", authRouter);
app.use("/api/github/repos", reposRouter);
app.use("/api/github/repos", webhooksRouter);
app.use("/api/github/webhook", webhookRouter);

app.listen(PORT, () => {
  console.log(`GitHub Service running on port ${PORT}`);
});

export default app;
