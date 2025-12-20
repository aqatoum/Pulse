const express = require("express");
const router = express.Router();

// NEW filenames
const ingestRoutes = require("./ingest.routes");
const analyticsRoutes = require("./analytics.routes");

// Mount
router.use("/ingest", ingestRoutes);
router.use("/analytics", analyticsRoutes);

module.exports = router;
