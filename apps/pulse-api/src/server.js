// apps/pulse-api/src/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const uploadRoutes = require("./routes/upload.routes");
const ingestRoutes = require("./routes/ingest.routes");
const analyticsRoutes = require("./routes/analytics.routes");

// Narrative reports endpoint
const reportsRoutes = require("./routes/reports.routes");

// ✅ Uploads advanced report endpoint: GET /api/uploads/report
const uploadsReportRoutes = require("./routes/uploads.report.routes");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI;

/* =========================
   ✅ Core middleware
   ========================= */
app.use(express.json({ limit: "2mb" }));

/* =========================
   ✅ CORS (local + production via env)
   ========================= */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.WEB_ORIGINS
    ? process.env.WEB_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : []),
];

app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.options("*", cors());

/* =========================
   ✅ Health payload (single source)
   ========================= */
function healthPayload(extra = {}) {
  return {
    ok: true,
    service: "PULSE API",
    status: "RUNNING",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    mongo: {
      connected: mongoose.connection?.readyState === 1,
      state: mongoose.connection?.readyState ?? null,
    },
    endpoints: {
      health: "/api/health",
      legacyHealth: "/health",
      ingest: "/api/ingest",
      analytics: "/api/analytics",
      upload: "/api/upload",

      // ✅ Unified uploads report endpoint
      uploadsReport: "/api/uploads/report",

      // narrative reports
      reports: "/api/reports/:signal",
    },
    ...extra,
  };
}

/* =========================
   ✅ Health routes
   ========================= */
app.get("/health", (req, res) => res.json(healthPayload()));
app.get("/api/health", (req, res) => res.json(healthPayload()));

app.get("/", (req, res) => {
  res.json({
    ...healthPayload({
      env: { hasMongoUri: Boolean(process.env.MONGODB_URI) },
    }),
    message: "Welcome to PULSE API. Use /api/health for status.",
  });
});

/* =========================
   ✅ API routes
   ========================= */
app.use("/api/ingest", ingestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/upload", uploadRoutes);

// ✅ Advanced uploads report
app.use("/api/uploads", uploadsReportRoutes);

// ✅ Narrative reports
app.use("/api/reports", reportsRoutes);

/* =========================
   ✅ 404 (JSON)
   ========================= */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
    method: req.method,
    known: healthPayload().endpoints,
  });
});

/* =========================
   ✅ Error handler (JSON)
   ========================= */
app.use((err, req, res, next) => {
  const status = Number(err?.status || err?.statusCode || 500);
  res.status(status).json({
    ok: false,
    error: err?.message || "Server error",
    path: req.originalUrl,
  });
});

/* =========================
   ✅ Start server (Cloud Run)
   ========================= */
app.listen(PORT, HOST, () => {
  console.log(`🚀 PULSE API listening on ${HOST}:${PORT}`);
  console.log(`🔎 ENV CHECK: MONGODB_URI present? ${Boolean(process.env.MONGODB_URI)}`);
});

/* =========================
   ✅ MongoDB connection events (debug)
   ========================= */
mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
mongoose.connection.on("disconnected", () => console.log("⚠️ MongoDB disconnected"));
mongoose.connection.on("error", (e) => console.error("❌ MongoDB error:", e?.message || e));

/* =========================
   ✅ Connect MongoDB (non-blocking)
   ========================= */
(async () => {
  try {
    if (!MONGODB_URI) {
      console.error("❌ MONGODB_URI is missing in env");
      return;
    }
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err?.message || err);
  }
})();
