const express = require("express");
const router = express.Router();

// NEW filenames
const ingestRoutes = require("./ingest.routes");
const analyticsRoutes = require("./analytics.routes");
const analyticsPrecheckRoutes = require("./analytics.precheck.routes");

// Mount
router.use("/ingest", ingestRoutes);
router.use("/analytics", analyticsRoutes);

// ✅ Add precheck under the same analytics namespace
// This enables: GET /api/analytics/precheck  (assuming server mounts this router under /api)
router.use("/analytics", analyticsPrecheckRoutes);

module.exports = router;

