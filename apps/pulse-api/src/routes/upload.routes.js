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
  limits: { fileSize: 15 * 1024 * 1024 },
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

// ISO week helpers
function getISOWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return { year, isoWeek: weekNo, yearWeek: `${year}-W${String(weekNo).padStart(2, "0")}` };
}

// POST /api/upload/lab-results
router.post("/lab-results", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(
        apiError({ status: 400, error: "CSV file is required (field name: file)" })
      );
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
      (cols.includes("collectedat") || cols.includes("testdate")) &&
      (cols.includes("regionid") || cols.includes("facilityid"));

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
              "regionId or facilityId",
              "labId(optional)",
              "testCode",
              "value",
              "collectedAt",
              "sex",
              "ageYears",
              "unit(optional)",
              "patientId(optional)",
            ],
            expectedOld: ["facilityId", "testDate", "hb", "sex", "ageYears"],
          },
        })
      );
    }

    // ✅ Create Upload record first (audit trail)
    // Fix: some schemas require originalFileName
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
      missingScope: 0,
      missingUnit: 0,
    };

    const docs = [];
    const seen = new Set();

    for (const r of records) {
      total++;

      if (hasOld && !hasNew) {
        const facilityId = String(r.facilityid || "").trim();
        const testDate = toDate(r.testdate || r.collectedat);
        const hb = toNumber(r.hb ?? r.hgb);
        const ageYears = toNumber(r.ageyears);
        const sex = normalizeSex(r.sex);

        let bad = false;

        if (!facilityId) {
          issues.missingScope++;
          bad = true;
        }
        if (!testDate) {
          issues.invalidDate++;
          bad = true;
        }
        if (hb === null || hb <= 0 || hb >= 25) {
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

        const key = `${facilityId}|HB|${testDate.toISOString()}|${sex}|${ageYears}|${hb}`;
        if (seen.has(key)) continue;
        seen.add(key);

        docs.push({
          uploadId: uploadDoc._id,
          regionId: "UNKNOWN",
          facilityId,
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
        });

        accepted++;
      } else {
        const regionId = String(r.regionid || "").trim() || "UNKNOWN";
        const facilityId = String(r.facilityid || "").trim() || null;
        const labId = String(r.labid || "").trim() || null;

        const testCode = normalizeTestCode(r.testcode);
        const value = toNumber(r.value);
        const collectedAt = toDate(r.collectedat || r.testdate);
        const sex = normalizeSex(r.sex);
        const ageYears = toNumber(r.ageyears);

        // unit optional في CSV لكن required في DB => default
        let unit = r.unit ? String(r.unit).trim() : null;
        if (!unit) {
          unit = defaultUnitForTest(testCode);
          issues.missingUnit++;
        }

        let bad = false;

        if (regionId === "UNKNOWN" && !facilityId) {
          issues.missingScope++;
          bad = true;
        }
        if (!testCode) {
          issues.invalidTestCode++;
          bad = true;
        }
        if (!collectedAt) {
          issues.invalidDate++;
          bad = true;
        }
        if (value === null) {
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

        const { year, isoWeek, yearWeek } = getISOWeekInfo(collectedAt);

        const patientKey = r.patientid ? String(r.patientid).trim() : null;

        const key = `${regionId}|${facilityId || ""}|${labId || ""}|${testCode}|${collectedAt.toISOString()}|${sex}|${ageYears}|${value}`;
        if (seen.has(key)) continue;
        seen.add(key);

        docs.push({
          uploadId: uploadDoc._id,
          regionId,
          facilityId,
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
        });

        accepted++;
      }
    }

    if (docs.length) {
      await LabResult.insertMany(docs, { ordered: false });
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

    const weeklyAgg = await updateWeeklyAggregatesFromDocs(docs);

    const facilities = Array.from(new Set(docs.map((d) => d.facilityId).filter(Boolean)));
    const regions = Array.from(new Set(docs.map((d) => d.regionId).filter(Boolean)));

    const facilityIdOut =
      facilities.length === 1 ? facilities[0] : facilities.length > 1 ? "MULTI" : null;
    const regionIdOut =
      regions.length === 1 ? regions[0] : regions.length > 1 ? "MULTI" : "UNKNOWN";

    return res.json(
      apiOk({
        facilityId: facilityIdOut || regionIdOut || "MULTI",
        analysis: {
          signalType: "ingest",
          method: "CSV_UPLOAD",
          params: {
            fileName: req.file.originalname,
            rowsParsed: total,
            schema: hasOld && !hasNew ? "LEGACY" : "NEW",
          },
        },
        data: {
          upload: {
            uploadId: String(uploadDoc._id),
            sha256: fileHash,
            fileName: req.file.originalname,
          },
          ingest: {
            summary: { total, accepted, rejected },
            quality: issues,
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
