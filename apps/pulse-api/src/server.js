// apps/pulse-api/src/server.js
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const uploadRoutes = require("./routes/upload.routes");
const ingestRoutes = require("./routes/ingest.routes");
const analyticsRoutes = require("./routes/analytics.routes");

// ✅ NEW: narrative reports endpoint
const reportsRoutes = require("./routes/reports.routes");

const Upload = require("./models/Upload");

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

      // existing
      reportUploads: "/api/report/uploads",
      reportSummary: "/api/report/summary",

      // ✅ NEW
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
   ✅ REPORT ROUTES (Uploads Registry)
   ========================= */

// GET /api/report/uploads
app.get("/api/report/uploads", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const skip = Math.max(Number(req.query.skip || 0), 0);

    const rows = await Upload.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select({
        originalFileName: 1,
        fileName: 1,
        mimeType: 1,
        sizeBytes: 1,
        sha256: 1,
        source: 1,
        schema: 1,
        rowsParsed: 1,
        rowsAccepted: 1,
        rowsRejected: 1,
        totalTests: 1,
        facilityIds: 1,
        regionIds: 1,
        dateRange: 1,
        testsByCode: 1,
        createdAt: 1,
        completedAt: 1,
      })
      .lean();

    const total = await Upload.countDocuments({});

    res.json({
      ok: true,
      meta: { total, limit, skip },
      data: {
        uploads: rows.map((u) => ({
          uploadId: String(u._id),
          fileName: u.originalFileName || u.fileName || null,
          mimeType: u.mimeType || null,
          sizeBytes: u.sizeBytes || null,
          sha256: u.sha256 || null,
          source: u.source || null,
          schema: u.schema || null,
          rowsParsed: u.rowsParsed ?? null,
          rowsAccepted: u.rowsAccepted ?? null,
          rowsRejected: u.rowsRejected ?? null,
          totalTests: u.totalTests ?? u.rowsAccepted ?? null,
          facilityIds: Array.isArray(u.facilityIds) ? u.facilityIds : [],
          regionIds: Array.isArray(u.regionIds) ? u.regionIds : [],
          dateRange: u.dateRange || { start: null, end: null },
          testsByCode:
            u.testsByCode && typeof u.testsByCode === "object" ? u.testsByCode : {},
          createdAt: u.createdAt || null,
          completedAt: u.completedAt || null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/report/summary
app.get("/api/report/summary", async (req, res, next) => {
  try {
    const all = await Upload.find({})
      .select({
        facilityIds: 1,
        regionIds: 1,
        testsByCode: 1,
        totalTests: 1,
        rowsAccepted: 1,
      })
      .lean();

    const facilities = new Set();
    const regions = new Set();
    const totalsByTest = {};
    let grandTotalTests = 0;

    for (const u of all) {
      (Array.isArray(u.facilityIds) ? u.facilityIds : []).forEach(
        (x) => x && facilities.add(String(x))
      );
      (Array.isArray(u.regionIds) ? u.regionIds : []).forEach(
        (x) => x && regions.add(String(x))
      );

      const tt = Number(u.totalTests ?? u.rowsAccepted ?? 0);
      if (Number.isFinite(tt)) grandTotalTests += tt;

      const map = u.testsByCode && typeof u.testsByCode === "object" ? u.testsByCode : {};
      for (const [k, v] of Object.entries(map)) {
        const code = String(k).toUpperCase();
        const n = Number(v || 0);
        if (!Number.isFinite(n)) continue;
        totalsByTest[code] = (totalsByTest[code] || 0) + n;
      }
    }

    res.json({
      ok: true,
      data: {
        uploadsCount: all.length,
        grandTotalTests,
        facilitiesCount: facilities.size,
        regionsCount: regions.size,
        facilityIds: Array.from(facilities).sort(),
        regionIds: Array.from(regions).sort(),
        testsByCode: Object.fromEntries(
          Object.entries(totalsByTest).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        ),
      },
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
   ✅ API routes
   ========================= */
app.use("/api/ingest", ingestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/upload", uploadRoutes);

// ✅ NEW: narrative reports (no conflict with /api/report/*)
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
