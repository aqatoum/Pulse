// apps/pulse-api/src/services/quality/dataQualityScan.service.js

function isValidDate(d) {
  if (!d) return false;
  const x = new Date(d);
  return !Number.isNaN(x.getTime());
}

function toWeekKey(d) {
  const x = new Date(d);
  // Week key: YYYY-WW (ISO-like enough for monitoring)
  // Use UTC to avoid timezone drift.
  const date = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yy}-W${ww}`;
}

function safeNum(n) {
  return Number.isFinite(n) ? n : null;
}

/**
 * scanRowsQuality
 * - DOES NOT reject rows; it only measures quality.
 * - Must be tolerant to schema aliases coming from CSV/ingest layer:
 *   value: value | result_value | resultValue
 *   date : testDate | collectedAt | collected_at | collectionDate
 *   sex  : sex | gender
 *   age  : ageYears | age | age_years
 */
function scanRowsQuality({ rows, rawCount }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const inferredRaw = safeRows.length;

  const out = {
    rawCount: Number.isFinite(Number(rawCount)) ? Number(rawCount) : inferredRaw,
    usableRows: 0,
    invalidValueCount: 0,
    invalidDateCount: 0,
    missingSexCount: 0,
    missingAgeCount: 0,
    valueMin: null,
    valueMax: null,
    uniqueWeeks: 0,
    weeks: {
      firstWeek: null,
      lastWeek: null,
      weekCounts: {}, // { "2025-W01": 123, ... }
    },
    flags: {
      smallSample: false,
      sparseTimeCoverage: false,
      manyInvalid: false,
    },
  };

  const weekCounts = {};
  let vMin = null;
  let vMax = null;

  for (const r of safeRows) {
    // ---- Value (aliases) ----
    const rawV = r?.value ?? r?.result_value ?? r?.resultValue;
    const v = typeof rawV === "number" ? rawV : Number(rawV);

    if (!Number.isFinite(v)) {
      out.invalidValueCount += 1;
      continue;
    }

    // ---- Date (aliases) ----
    const dateVal =
      r?.testDate ??
      r?.collectedAt ??
      r?.collected_at ??
      r?.collectionDate ??
      r?.date ??
      r?.timestamp;

    if (!isValidDate(dateVal)) {
      out.invalidDateCount += 1;
      continue;
    }

    // usable row
    out.usableRows += 1;

    // ---- Sex (aliases) ----
    const sexVal = r?.sex ?? r?.gender;
    if (!sexVal) out.missingSexCount += 1;

    // ---- Age (aliases) ----
    const ageVal = r?.ageYears ?? r?.age ?? r?.age_years;
    if (ageVal === null || ageVal === undefined || !Number.isFinite(Number(ageVal))) {
      out.missingAgeCount += 1;
    }

    // ---- min/max ----
    vMin = vMin === null ? v : Math.min(vMin, v);
    vMax = vMax === null ? v : Math.max(vMax, v);

    // ---- week counts ----
    const wk = toWeekKey(dateVal);
    weekCounts[wk] = (weekCounts[wk] || 0) + 1;
  }

  out.valueMin = safeNum(vMin);
  out.valueMax = safeNum(vMax);

  out.weeks.weekCounts = weekCounts;
  const weekKeys = Object.keys(weekCounts).sort();
  out.uniqueWeeks = weekKeys.length;
  out.weeks.firstWeek = weekKeys[0] || null;
  out.weeks.lastWeek = weekKeys[weekKeys.length - 1] || null;

  // Flags (calm, not alarmist)
  const invalidTotal = out.invalidValueCount + out.invalidDateCount;
  out.flags.manyInvalid = out.rawCount > 0 ? invalidTotal / out.rawCount > 0.05 : false;
  out.flags.smallSample = out.usableRows > 0 ? out.usableRows < 50 : true;
  out.flags.sparseTimeCoverage = out.uniqueWeeks > 0 ? out.uniqueWeeks < 4 : true;

  return out;
}

module.exports = { scanRowsQuality };
