// apps/pulse-api/src/routes/index.js
const express = require("express");
const router = express.Router();

// Existing routes
const ingestRoutes = require("./ingest.routes");
const analyticsRoutes = require("./analytics.routes");

// ✅ NEW: precheck route (make sure this file exists)
const analyticsPrecheckRoutes = require("./analytics.precheck.routes");

// Mount
router.use("/ingest", ingestRoutes);

// ✅ Analytics main endpoints (run/report/summary...etc)
router.use("/analytics", analyticsRoutes);

// ✅ Analytics precheck endpoint: /api/analytics/precheck
router.use("/analytics", analyticsPrecheckRoutes);

module.exports = router;
