const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const uploadRoutes = require("./routes/upload.routes");
const ingestRoutes = require("./routes/ingest.routes");
const analyticsRoutes = require("./routes/analytics.routes");

// ✅ NEW: Upload model for reporting
const Upload = require("./models/Upload");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 4000);
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
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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
      reportUploads: "/api/report/uploads",
      reportSummary: "/api/report/summary",
    },
  };
}

/* =========================
   ✅ Health routes
   ========================= */
app.get("/health", (req, res) => res.json(healthPayload()));
app.get("/api/health", (req, res) => res.json(healthPayload()));

app.get("/", (req, res) => {
  res.json({
    ...healthPayload(),
    message: "Welcome to PULSE API. Use /api/health for status.",
  });
});

/* =========================
   ✅ REPORT ROUTES (Uploads Registry)
   ========================= */

/**
 * GET /api/report/uploads
 * Returns all uploaded files with facilityIds/regionIds/dateRange/testsByCode/rowsAccepted...
 * Query options:
 *   ?limit=50&skip=0
 */
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

          // Map في مونجو قد يرجع كـ object أو Map حسب سكيمتك
          testsByCode:
            u.testsByCode && typeof u.testsByCode === "object"
              ? u.testsByCode
              : {},

          createdAt: u.createdAt || null,
          completedAt: u.completedAt || null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/report/summary
 * Global summary across ALL uploads:
 * - unique facilities, unique regions
 * - total tests per testCode across uploads (sum)
 */
app.get("/api/report/summary", async (req, res, next) => {
  try {
    // 1) pull only fields we need (fast)
    const all = await Upload.find({})
      .select({ facilityIds: 1, regionIds: 1, testsByCode: 1, totalTests: 1, rowsAccepted: 1 })
      .lean();

    const facilities = new Set();
    const regions = new Set();
    const totalsByTest = {}; // summed across uploads
    let grandTotalTests = 0;

    for (const u of all) {
      (Array.isArray(u.facilityIds) ? u.facilityIds : []).forEach((x) => x && facilities.add(String(x)));
      (Array.isArray(u.regionIds) ? u.regionIds : []).forEach((x) => x && regions.add(String(x)));

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

/* =========================
   ✅ DEBUG: print routes snapshot once at startup
   ========================= */
function listRoutes(appInstance) {
  try {
    const out = [];
    const stack = appInstance?._router?.stack || [];

    for (const layer of stack) {
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods || {})
          .map((m) => m.toUpperCase())
          .join(",");
        out.push(`${methods} ${layer.route.path}`);
        continue;
      }

      if (layer?.name === "router" && layer?.handle?.stack) {
        for (const h of layer.handle.stack) {
          if (h?.route?.path) {
            const methods = Object.keys(h.route.methods || {})
              .map((m) => m.toUpperCase())
              .join(",");
            out.push(`${methods} (mounted) ${h.route.path}`);
          }
        }
      }
    }

    console.log("=== ROUTES SNAPSHOT (first 200) ===");
    out.slice(0, 200).forEach((r) => console.log(r));
    console.log("===================================");
  } catch (e) {
    console.log("Routes snapshot failed:", e?.message || e);
  }
}

/* =========================
   ✅ 404 (JSON, Codex-friendly)
   ========================= */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not Found",
    path: req.originalUrl,
    method: req.method,
    hint: "Check route mount points in server.js and the route path inside the router file.",
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

    listRoutes(app);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
}

startServer();
