import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB, getDbState } from "./config/db.js";
import demoRoutes from "./routes/demoRoutes.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "saboot-server",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    dbState: getDbState(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/demo", demoRoutes);

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || "Internal server error",
  });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] Saboot API listening on http://localhost:${PORT}`);
  });
}

start();
