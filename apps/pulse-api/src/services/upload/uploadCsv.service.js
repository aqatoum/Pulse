// apps/pulse-api/src/services/upload/uploadCsv.service.js
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");

const labResultRepo = require("../../repositories/labResult.repository");
const uploadRepo = require("../../repositories/upload.repository");

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
 * Ingest CSV buffer into Upload + LabResult documents.
 * Preserves your existing UNIVERSAL/LEGACY schema logic and counters.
 */
async function ingestCsvBuffer({ file }) {
  if (!file?.buffer) {
    const err = new Error("Missing file");
    err.code = "MISSING_FILE";
    throw err;
  }

  const buf = file.buffer;
  const fileHash = sha256(buf);

  // prevent duplicates
  const existing = await uploadRepo.findBySha256(fileHash);
  if (existing) {
    const err = new Error("DUPLICATE_UPLOAD");
    err.code = "DUPLICATE_UPLOAD";
    err.details = {
      uploadId: existing._id,
      fileName: existing.originalFileName || existing.fileName || null,
      createdAt: existing.createdAt,
    };
    throw err;
  }

  const csvText = buf.toString("utf-8");
  const records = parse(csvText, {
    columns: (header) => header.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  });

  if (!records.length) {
    const err = new Error("Empty CSV");
    err.code = "EMPTY_CSV";
    throw err;
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
    const err = new Error("Unrecognized CSV schema");
    err.code = "BAD_SCHEMA";
    err.details = {
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
    };
    throw err;
  }

  // Create Upload record first
  const uploadDoc = await uploadRepo.createUpload({
    originalFileName: file.originalname,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256: fileHash,
    rowsParsed: records.length,
    source: "CSV",
    uploadedAt: new Date(),

    facilityIds: [],
    regionIds: [],
    labIds: [],
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

  const facilitySet = new Set();
  const regionSet = new Set();
  const labSet = new Set();

  for (const r of records) {
    total++;

    // UNIVERSAL / NEW
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

      if (facilityId) facilitySet.add(facilityId);
      if (regionId) regionSet.add(regionId);
      if (labId) labSet.add(labId);

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

    // LEGACY HB
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

      if (facilityId) facilitySet.add(facilityId);

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
    await labResultRepo.insertManyResults(docs);
  }

  await uploadRepo.updateUploadMetadata(uploadDoc._id, {
    rowsParsed: total,
    rowsAccepted: accepted,
    rowsRejected: rejected,
    facilityIds: Array.from(facilitySet),
    regionIds: Array.from(regionSet),
    labIds: Array.from(labSet),
    quality: issues,
    completedAt: new Date(),
  });

  return {
    uploadId: String(uploadDoc._id),
    sha256: fileHash,
    schema: hasNew ? "UNIVERSAL" : "LEGACY",
    totals: { total, accepted, rejected },
    issues,
    docs, // important for weeklyAgg update
    fileName: file.originalname,
  };
}

module.exports = { ingestCsvBuffer };
