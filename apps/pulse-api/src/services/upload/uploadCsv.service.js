const crypto = require("crypto");
const { parse } = require("csv-parse/sync");

const labResultRepository = require("../../repositories/labResult.repository");
const uploadRepository = require("../../repositories/upload.repository");
const { updateWeeklyAggregatesFromDocs } = require("../aggregate/weeklyAgg.service");

const createServiceError = (status, error, details) => {
  const err = new Error(error);
  err.status = status;
  err.details = details;
  return err;
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase();

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeSex = (value) => {
  const s = String(value || "").trim().toUpperCase();
  if (s === "M" || s === "F") return s;
  return "U";
};

const normalizeTestCode = (value) => {
  const s = String(value || "").trim().toUpperCase();
  if (!s) return null;
  if (s === "HGB") return "HB";
  return s;
};

const defaultUnitForTest = (testCode) => {
  const t = String(testCode || "").toUpperCase();
  if (t === "HB") return "g/dL";
  return "unit";
};

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const getISOWeekInfo = (dateObj) => {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  const isoWeek = weekNo;
  const yearWeek = `${year}-W${String(isoWeek).padStart(2, "0")}`;
  return { year, isoWeek, yearWeek };
};

const handleCsvUpload = async (file) => {
  if (!file) {
    throw createServiceError(400, "Missing file");
  }

  const buf = file.buffer;
  const fileHash = sha256(buf);

  const existing = await uploadRepository.findBySha256(fileHash);
  if (existing) {
    throw createServiceError(409, "This file was already uploaded", {
      uploadId: existing._id,
      fileName: existing.originalFileName || existing.fileName || null,
      createdAt: existing.createdAt,
    });
  }

  const csvText = buf.toString("utf-8");
  const records = parse(csvText, {
    columns: (header) => header.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  });

  if (!records.length) {
    throw createServiceError(400, "Empty CSV");
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
    throw createServiceError(400, "Unrecognized CSV schema", {
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
    });
  }

  const uploadDoc = await uploadRepository.createUpload({
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
    await labResultRepository.insertManyResults(docs);
  }

  let weeklyAgg = null;
  try {
    weeklyAgg = await updateWeeklyAggregatesFromDocs(docs);
  } catch (e) {
    console.warn("weeklyAgg update skipped/failed:", e?.message || e);
  }

  await uploadRepository.updateUploadMetadata(uploadDoc._id, {
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
    analysis: {
      signalType: "ingest",
      method: "CSV_UPLOAD",
      params: {
        fileName: file.originalname,
        rowsParsed: total,
        schema: hasNew ? "UNIVERSAL" : "LEGACY",
      },
    },
    data: {
      upload: {
        uploadId: String(uploadDoc._id),
        sha256: fileHash,
        fileName: file.originalname,
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
  };
};

module.exports = {
  handleCsvUpload,
};
