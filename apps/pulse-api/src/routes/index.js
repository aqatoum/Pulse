const express = require("express");
const router = express.Router();
router.use("/upload", require("./upload.routes"));
// NEW filenames
const ingestRoutes = require("./ingest.routes");
const analyticsRoutes = require("./analytics.routes");

// Mount
router.use("/ingest", ingestRoutes);
router.use("/analytics", analyticsRoutes);

module.exports = router;
