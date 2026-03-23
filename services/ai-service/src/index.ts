import "dotenv/config";
import express from "express";
import cors from "cors";
import { reviewRouter } from "./routes/review";
import { explainRouter } from "./routes/explain";
import { docsRouter } from "./routes/docs";

const app = express();
const PORT = process.env.AI_SERVICE_PORT || 3003;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-service" });
});

app.use("/api/ai/review", reviewRouter);
app.use("/api/ai/explain", explainRouter);
app.use("/api/ai/docs", docsRouter);

app.listen(PORT, () => {
  console.log(`AI Service running on port ${PORT}`);
});

export default app;
