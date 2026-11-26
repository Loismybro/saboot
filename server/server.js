import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { connectDB, getDbState } from "./config/db.js";
import { RepairRate } from "./models/RepairRate.js";
import { ensureRepairRatesSeeded } from "./seed/seedData.js";
import demoRoutes from "./routes/demoRoutes.js";
import rentalRoutes from "./routes/rentalRoutes.js";
import settlementRoutes from "./routes/settlementRoutes.js";
import { handleMcpRequest } from "./mcp/mcpServer.js";
import { runOverdueScan, startOverdueCron } from "./jobs/overdueJob.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST_DIR = path.resolve(__dirname, "../client/dist");
const CLIENT_INDEX_HTML = path.join(CLIENT_DIST_DIR, "index.html");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const renderOrigin = process.env.RENDER_EXTERNAL_URL
  ? [process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, "")]
  : [];

const allowedOrigins = Array.from(
  new Set([...LOCAL_DEV_ORIGINS, ...envOrigins, ...renderOrigin])
);

app.use(
  cors({
    origin: (origin, callback) => {
      const normalized = origin ? origin.replace(/\/+$/, "") : "";
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(normalized)
      ) {
        return callback(null, true);
      }
      const err = new Error(`CORS blocked for origin: ${origin}`);
      err.status = 403;
      return callback(err);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Mcp-Session-Id", "Authorization"],
    exposedHeaders: ["Mcp-Session-Id"],
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

app.get("/api/rates", async (req, res, next) => {
  try {
    const rates = await RepairRate.find().sort({ category: 1, itemKeyword: 1 });
    res.json({ ok: true, count: rates.length, rates });
  } catch (err) {
    next(err);
  }
});
app.use("/api/demo", demoRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/settlements", settlementRoutes);
app.post("/mcp", handleMcpRequest);
app.all("/mcp", (req, res) => {
  res.status(405).json({
    ok: false,
    error: "Use POST /mcp for stateless Streamable HTTP MCP requests.",
  });
});
app.post("/api/jobs/run-overdue", async (req, res, next) => {
  try {
    const result = await runOverdueScan();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({
    ok: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

if (fs.existsSync(CLIENT_INDEX_HTML)) {
  app.use(
    "/assets",
    express.static(path.join(CLIENT_DIST_DIR, "assets"), { maxAge: "7d" })
  );
  app.use(
    express.static(CLIENT_DIST_DIR, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(CLIENT_INDEX_HTML);
  });
}

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  if (err?.name === "MulterError") {
    return res.status(400).json({
      ok: false,
      error: err.message || "File upload error",
      code: err.code,
    });
  }
  const status =
    err.status ||
    err.statusCode ||
    (err?.name === "ValidationError" || err?.name === "CastError" ? 400 : 500);
  res.status(status).json({
    ok: false,
    error: err.message || "Internal server error",
  });
});

function scheduleDbReconnect() {
  const timer = setInterval(async () => {
    if (getDbState() === "connected") {
      clearInterval(timer);
      return;
    }
    const ok = await connectDB(1);
    if (ok) {
      ensureRepairRatesSeeded().catch((err) =>
        console.warn("[seed] Auto-seed rates skipped:", err.message)
      );
    }
  }, 15000);
  timer.unref();
}

async function start() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Saboot listening on http://0.0.0.0:${PORT}`);
  });
  const connected = await connectDB();
  if (connected) {
    ensureRepairRatesSeeded().catch((err) =>
      console.warn("[seed] Auto-seed rates skipped:", err.message)
    );
  } else if (process.env.MONGODB_URI) {
    scheduleDbReconnect();
  }
  startOverdueCron();
}

start();
