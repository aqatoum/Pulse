const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");

const LabResult = require("../models/LabResult");
const Upload = require("../models/Upload");
const { apiOk, apiError } = require("../utils/response");

const { updateWeeklyAggregatesFromDocs } =
  require("../services/aggregate/weeklyAgg.service.js");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSex(v) {
  const s = String(v || "").trim().toUpperCase();
  if (s === "M" || s === "F") return s;
  return "U";
}

function normalizeTestCode(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!s) return null;
  if (s === "HGB") return "HB";
  return s;
}

function defaultUnitForTest(testCode) {
  const t = String(testCode || "").toUpperCase();
  if (t === "HB") return "g/dL";
  return "unit";
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function getISOWeekInfo(dateObj) {
  // ISO week based on UTC to be stable
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  const isoWeek = weekNo;
  const yearWeek = `${year}-W${String(isoWeek).padStart(2, "0")}`;
  return { year, isoWeek, yearWeek };
}

/**
 * POST /api/upload/csv
 * Universal CSV template (recommended):
 * collectedAt,testCode,value,unit,sex,ageYears,nationality,facilityId,facilityName,regionId,regionName,labId,patientKey
 *
 * facilityId/regionId/labId are OPTIONAL. If both facilityId and regionId empty => GLOBAL.
 * Supports any testCode.
 *
 * Legacy supported:
 * facilityId,testDate,hb(or hgb),sex,ageYears
 */
router.post("/csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(apiError({ status: 400, error: "Missing file" }));
    }

    const buf = req.file.buffer;
    const fileHash = sha256(buf);

    // prevent duplicate same file re-upload
    const existing = await Upload.findOne({ sha256: fileHash }).lean();
    if (existing) {
      return res.status(409).json(
        apiError({
          status: 409,
          error: "This file was already uploaded",
          details: {
            uploadId: existing._id,
            fileName: existing.originalFileName || existing.fileName || null,
            createdAt: existing.createdAt,
          },
        })
      );
    }

    const csvText = buf.toString("utf-8");
    const records = parse(csvText, {
      columns: (header) => header.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
    });

    if (!records.length) {
      return res.status(400).json(apiError({ status: 400, error: "Empty CSV" }));
    }

    const cols = Object.keys(records[0] || {});
    const hasNew =
      cols.includes("testcode") &&
      cols.includes("value") &&
      (cols.includes("collectedat") || cols.includes("testdate"));

    const hasOld =
      cols.includes("facilityid") &&
      (cols.includes("testdate") || cols.includes("collectedat")) &&
      (cols.includes("hb") || cols.includes("hgb")) &&
      cols.includes("sex") &&
      cols.includes("ageyears");

    if (!hasNew && !hasOld) {
      return res.status(400).json(
        apiError({
          status: 400,
          error: "Unrecognized CSV schema",
          details: {
            gotColumns: cols,
            expectedNew: [
              "collectedAt (or testDate)",
              "testCode",
              "value",
              "unit (optional)",
              "sex (optional)",
              "ageYears",
              "nationality (optional)",
              "facilityId / regionId / labId (optional)",
              "facilityName / regionName (optional)",
              "patientKey (optional)",
            ],
            expectedOld: ["facilityId", "testDate", "hb (or hgb)", "sex", "ageYears"],
          },
        })
      );
    }

    // ✅ Create Upload record first (audit trail)
    const uploadDoc = await Upload.create({
      originalFileName: req.file.originalname,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      sha256: fileHash,
      rowsParsed: records.length,
      source: "CSV",
    });

    let total = 0;
    let accepted = 0;
    let rejected = 0;

    const issues = {
      invalidDate: 0,
      invalidValue: 0,
      invalidAge: 0,
      invalidTestCode: 0,
      missingUnit: 0,
    };

    const docs = [];
    const seen = new Set();

    for (const r of records) {
      total++;

      // ===== UNIVERSAL / NEW SCHEMA =====
      // Supports any testCode, optional facility/region/lab, and optional nationality.
      if (hasNew) {
        const testCode = normalizeTestCode(r.testcode);
        const value = toNumber(r.value);
        const collectedAt = toDate(r.collectedat || r.testdate);

        const ageYears = toNumber(r.ageyears);
        const sex = normalizeSex(r.sex);

        const unitRaw = String(r.unit || "").trim();
        const unit = unitRaw || defaultUnitForTest(testCode);

        const facilityId = String(r.facilityid || "").trim() || null;
        const facilityName = String(r.facilityname || "").trim() || null;
        const regionId = String(r.regionid || "").trim() || null;
        const regionName = String(r.regionname || "").trim() || null;
        const labId = String(r.labid || "").trim() || null;

        const nationality = String(r.nationality || "").trim() || null;
        const patientKey = String(r.patientkey || r.patientid || "").trim() || null;

        let bad = false;
        if (!testCode) {
          issues.invalidTestCode++;
          bad = true;
        }
        if (value === null) {
          issues.invalidValue++;
          bad = true;
        }
        if (!collectedAt) {
          issues.invalidDate++;
          bad = true;
        }
        if (ageYears === null || ageYears < 0 || ageYears > 120) {
          issues.invalidAge++;
          bad = true;
        }
        if (!unit) {
          issues.missingUnit++;
          bad = true;
        }

        if (bad) {
          rejected++;
          continue;
        }

        const { year, isoWeek, yearWeek } = getISOWeekInfo(collectedAt);

        const key = `${facilityId || ""}|${regionId || ""}|${labId || ""}|${testCode}|${collectedAt.toISOString()}|${sex}|${ageYears}|${value}`;
        if (seen.has(key)) continue;
        seen.add(key);

        docs.push({
          uploadId: uploadDoc._id,

          facilityId,
          facilityName,
          regionId,
          regionName,
          labId,

          patientKey,

          testCode,
          value,
          unit,

          collectedAt,
          year,
          isoWeek,
          yearWeek,

          sex,
          ageYears,
          nationality,
        });

        accepted++;
        continue;
      }

      // ===== LEGACY SCHEMA (HB columns) =====
      if (hasOld && !hasNew) {
        const facilityId = String(r.facilityid || "").trim() || null;
        const testDate = toDate(r.testdate || r.collectedat);
        const hb = toNumber(r.hb ?? r.hgb);
        const ageYears = toNumber(r.ageyears);
        const sex = normalizeSex(r.sex);

        let bad = false;
        if (!testDate) {
          issues.invalidDate++;
          bad = true;
        }
        if (hb === null) {
          issues.invalidValue++;
          bad = true;
        }
        if (ageYears === null || ageYears < 0 || ageYears > 120) {
          issues.invalidAge++;
          bad = true;
        }

        if (bad) {
          rejected++;
          continue;
        }

        const { year, isoWeek, yearWeek } = getISOWeekInfo(testDate);

        const key = `${facilityId || ""}|HB|${testDate.toISOString()}|${sex}|${ageYears}|${hb}`;
        if (seen.has(key)) continue;
        seen.add(key);

        docs.push({
          uploadId: uploadDoc._id,

          regionId: null,
          facilityId,
          facilityName: null,
          regionName: null,
          labId: null,

          patientKey: null,

          testCode: "HB",
          value: hb,
          unit: "g/dL",

          collectedAt: testDate,
          year,
          isoWeek,
          yearWeek,

          sex,
          ageYears,
          nationality: null,
        });

        accepted++;
        continue;
      }

      rejected++;
    }

    if (docs.length) {
      await LabResult.insertMany(docs, { ordered: false });
    }

    // update weekly aggregates (if your service supports generic testCode, this works for all)
    let weeklyAgg = null;
    try {
      weeklyAgg = await updateWeeklyAggregatesFromDocs(docs);
    } catch (e) {
      console.warn("weeklyAgg update skipped/failed:", e?.message || e);
    }

    await Upload.updateOne(
      { _id: uploadDoc._id },
      {
        $set: {
          rowsAccepted: accepted,
          rowsRejected: rejected,
          completedAt: new Date(),
        },
      }
    );

    return res.json(
      apiOk({
        analysis: {
          signalType: "ingest",
          method: "CSV_UPLOAD",
          params: {
            fileName: req.file.originalname,
            rowsParsed: total,
            schema: hasNew ? "UNIVERSAL" : "LEGACY",
          },
        },
        data: {
          upload: {
            uploadId: String(uploadDoc._id),
            sha256: fileHash,
            fileName: req.file.originalname,
          },
          ingest: {
            totalRows: total,
            accepted,
            rejected,
            issues,
          },
          weeklyAggregates: weeklyAgg,
        },
        interpretation: null,
      })
    );
  } catch (err) {
    console.error("UPLOAD error:", err);
    return res.status(500).json(
      apiError({ status: 500, error: "Server error", details: err.message })
    );
  }
});

module.exports = router;
