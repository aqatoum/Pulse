const express = require("express");
const multer = require("multer");
const { apiOk, apiError } = require("../utils/response");

const { handleCsvUpload } = require("../services/upload/uploadCsv.service");
const { buildUploadReport } = require("../services/upload/uploadReport.service");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/* =========================================================
   POST /api/upload/csv
   Universal CSV template (recommended):
   collectedAt,testCode,value,unit,sex,ageYears,nationality,
   facilityId,facilityName,regionId,regionName,labId,patientKey

   facilityId/regionId/labId OPTIONAL — if empty => accepted (GLOBAL).
   Supports any testCode.

   Legacy supported:
   facilityId,testDate,hb(or hgb),sex,ageYears
   ========================================================= */
router.post("/csv", upload.single("file"), async (req, res) => {
  try {
    const payload = await handleCsvUpload(req.file);
    return res.json(apiOk(payload));
  } catch (err) {
    if (err.status) {
      return res
        .status(err.status)
        .json(apiError({ status: err.status, error: err.message, details: err.details }));
    }

    console.error("UPLOAD error:", err);
    return res
      .status(500)
      .json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* =========================================================
   GET /api/upload/report
   تقرير كامل:
   - totals: files, tests, facilities, regions
   - byTest: counts per testCode (clean + includes unknown)
   - facilities: top facilities by rows
   - regions: top regions by rows
   - uploads: last uploads snapshot (optional helpful)
   ========================================================= */
router.get("/report", async (req, res) => {
  try {
    const payload = await buildUploadReport();
    return res.json(apiOk(payload));
  } catch (err) {
    return res.status(500).json(
      apiError({ status: 500, error: "Report failed", details: err?.message })
    );
  }
});

module.exports = router;
