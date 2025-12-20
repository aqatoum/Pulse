const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const uploadRoutes = require("./routes/upload.routes");
const ingestRoutes = require("./routes/ingest.routes");
const analyticsRoutes = require("./routes/analytics.routes");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI;

/* =========================
   ✅ Core middleware
   ========================= */
app.use(express.json({ limit: "2mb" }));

/* =========================
   ✅ CORS (local portal + predictable)
   ========================= */
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: function (origin, cb) {
      // allow non-browser tools (curl/postman) with no origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Ensure preflight works everywhere
app.options("*", cors());

/* =========================
   ✅ Health payload (single source)
   ========================= */
function healthPayload() {
  return {
    ok: true,
    service: "PULSE API",
    status: "RUNNING",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      legacyHealth: "/health",
      ingest: "/api/ingest",
      analytics: "/api/analytics",
      upload: "/api/upload",
    },
  };
}

/* =========================
   ✅ Health routes
   ========================= */
app.get("/health", (req, res) => res.json(healthPayload()));
app.get("/api/health", (req, res) => res.json(healthPayload()));

/* =========================
   ✅ API routes
   ========================= */
app.use("/api/ingest", ingestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/upload", uploadRoutes);

/* =========================
   ✅ 404 (JSON, Codex-friendly)
   ========================= */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
    method: req.method,
    hint:
      "Check route mount points in server.js and the route path inside the router file.",
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
   ✅ Bootstrap
   ========================= */
async function startServer() {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");

    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
}

startServer();
