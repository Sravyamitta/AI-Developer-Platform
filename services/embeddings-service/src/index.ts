import "dotenv/config";
import express from "express";
import cors from "cors";
import { indexRouter } from "./routes/index-repo";
import { indexPartialRouter } from "./routes/index-partial";
import { searchRouter } from "./routes/search";

const app = express();
const PORT = process.env.EMBEDDINGS_SERVICE_PORT || 3004;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "embeddings-service" });
});

app.use("/api/embeddings/index", indexRouter);
app.use("/api/embeddings/index/partial", indexPartialRouter);
app.use("/api/embeddings/search", searchRouter);

app.listen(PORT, () => {
  console.log(`Embeddings Service running on port ${PORT}`);
});

export default app;
