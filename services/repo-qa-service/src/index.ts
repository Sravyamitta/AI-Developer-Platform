import "dotenv/config";
import express from "express";
import cors from "cors";
import { qaRouter } from "./routes/qa";

const app = express();
const PORT = process.env.REPO_QA_SERVICE_PORT || 3005;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "repo-qa-service" });
});

app.use("/api/qa", qaRouter);

app.listen(PORT, () => {
  console.log(`Repo QA Service running on port ${PORT}`);
});

export default app;
