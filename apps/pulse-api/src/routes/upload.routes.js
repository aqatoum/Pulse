// apps/pulse-api/src/routes/upload.routes.js
const express = require("express");
const multer = require("multer");

const { apiOk, apiError } = require("../utils/response");
const { updateWeeklyAggregatesFromDocs } =
  require("../services/aggregate/weeklyAgg.service.js");

const { ingestCsvBuffer } = require("../services/upload/uploadCsv.service");

const labResultRepo = require("../repositories/labResult.repository");
const uploadRepo = require("../repositories/upload.repository");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/* =========================================================
   POST /api/upload/csv
   ========================================================= */
router.post("/csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(apiError({ status: 400, error: "Missing file" }));
    }

    const result = await ingestCsvBuffer({ file: req.file });

    // weekly aggregates (same behavior)
    let weeklyAgg = null;
    try {
      weeklyAgg = await updateWeeklyAggregatesFromDocs(result.docs);
    } catch (e) {
      console.warn("weeklyAgg update skipped/failed:", e?.message || e);
    }

    return res.json(
      apiOk({
        analysis: {
          signalType: "ingest",
          method: "CSV_UPLOAD",
          params: {
            fileName: result.fileName,
            rowsParsed: result.totals.total,
            schema: result.schema,
          },
        },
        data: {
          upload: {
            uploadId: result.uploadId,
            sha256: result.sha256,
            fileName: result.fileName,
          },
          ingest: {
            totalRows: result.totals.total,
            accepted: result.totals.accepted,
            rejected: result.totals.rejected,
            issues: result.issues,
          },
          weeklyAggregates: weeklyAgg,
        },
        interpretation: null,
      })
    );
  } catch (err) {
    // preserve your duplicate behavior as 409
    if (err?.code === "DUPLICATE_UPLOAD") {
      return res.status(409).json(
        apiError({
          status: 409,
          error: "This file was already uploaded",
          details: err.details || null,
        })
      );
    }

    if (err?.code === "EMPTY_CSV") {
      return res
        .status(400)
        .json(apiError({ status: 400, error: "Empty CSV" }));
    }

    if (err?.code === "BAD_SCHEMA") {
      return res.status(400).json(
        apiError({
          status: 400,
          error: "Unrecognized CSV schema",
          details: err.details || null,
        })
      );
    }

    console.error("UPLOAD error:", err);
    return res.status(500).json(
      apiError({ status: 500, error: "Server error", details: err?.message })
    );
  }
});

/* =========================================================
   GET /api/upload/report
   (same output, but via repositories where possible)
   ========================================================= */
router.get("/report", async (req, res) => {
  try {
    const files = await uploadRepo.countUploads();
    const tests = await labResultRepo.countLabResults();

    const facilityIds = await labResultRepo.distinctFacilityIds();
    const regionIds = await labResultRepo.distinctRegionIds();

    const byTest = await labResultRepo.aggregateByTest();
    const facilities = await labResultRepo.aggregateFacilities();
    const regions = await labResultRepo.aggregateRegions();
    const uploads = await uploadRepo.listRecentUploads(50);

    return res.json(
      apiOk({
        data: {
          totals: {
            files,
            tests,
            facilities: facilityIds.length,
            regions: regionIds.length,
          },
          byTest,
          facilities,
          regions,
          uploads,
        },
      })
    );
  } catch (err) {
    return res.status(500).json(
      apiError({ status: 500, error: "Report failed", details: err?.message })
    );
  }
});

module.exports = router;
