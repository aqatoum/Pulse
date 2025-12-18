const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const dayjs = require("dayjs");

const LabResult = require("../models/LabResult");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const REQUIRED_COLUMNS = ["facilityid", "patientkey", "sex", "ageyears", "testdate"];

// تطبيع أسماء الأعمدة
function normalizeKey(k) {
  return String(k || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeRecordKeys(record) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

router.get("/ping", (req, res) => {
  res.json({
    route: "ingest",
    status: "alive",
    time: new Date().toISOString()
  });
});

router.post("/csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      error: "Missing file. Use multipart/form-data with field name: file"
    });
  }

  let recordsRaw;
  try {
    recordsRaw = parse(req.file.buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "Invalid CSV format",
      details: err.message
    });
  }

  if (!recordsRaw.length) {
    return res.status(400).json({
      ok: false,
      error: "CSV is empty"
    });
  }

  const records = recordsRaw.map(normalizeRecordKeys);

  const keys = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => !keys.includes(c));

  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: "Missing required columns",
      missingRequiredColumns: missing,
      foundColumns: keys
    });
  }

  let inserted = 0;

  const summary = {
    totalRows: records.length,
    sexCounts: { M: 0, F: 0, U: 0 },
    age: { min: null, max: null, mean: null }
  };

  let ageSum = 0;
  let ageCount = 0;

  for (const r of records) {
    const sexRaw = String(r.sex || "").toUpperCase();
    const sex = sexRaw === "M" || sexRaw === "F" ? sexRaw : "U";

    const age = Number(r.ageyears);
    const testDate = dayjs(r.testdate).isValid()
      ? dayjs(r.testdate).toDate()
      : null;

    if (!Number.isFinite(age) || !testDate) continue;

    await LabResult.create({
      facilityId: r.facilityid,
      patientKey: r.patientkey,
      sex,
      ageYears: age,
      testDate,
      hb: r.hb !== undefined ? Number(r.hb) : null,
      wbc: r.wbc !== undefined ? Number(r.wbc) : null,
      plt: r.plt !== undefined ? Number(r.plt) : null,
      sourceFile: req.file.originalname
    });

    inserted++;

    // summary
    summary.sexCounts[sex]++;
    summary.age.min = summary.age.min === null ? age : Math.min(summary.age.min, age);
    summary.age.max = summary.age.max === null ? age : Math.max(summary.age.max, age);
    ageSum += age;
    ageCount++;
  }

  if (ageCount > 0) {
    summary.age.mean = Number((ageSum / ageCount).toFixed(2));
  }

  return res.json({
    ok: true,
    insertedRows: inserted,
    summary
  });
});

module.exports = router;
