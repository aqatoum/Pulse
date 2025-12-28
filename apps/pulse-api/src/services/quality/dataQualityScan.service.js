// apps/pulse-api/src/services/quality/dataQualityScan.service.js

function isValidDate(d) {
  if (!d) return false;
  const x = new Date(d);
  return !Number.isNaN(x.getTime());
}

function toWeekKey(d) {
  const x = new Date(d);
  // Week key: YYYY-WW (rough, ISO-like enough for monitoring)
  // We'll compute using UTC to avoid timezone drift.
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

function scanRowsQuality({ rows, rawCount }) {
  const out = {
    rawCount: Number(rawCount || 0),
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

  for (const r of rows || []) {
    const v = typeof r.value === "number" ? r.value : Number(r.value);
    if (!Number.isFinite(v)) {
      out.invalidValueCount += 1;
      continue;
    }

    if (!isValidDate(r.testDate)) {
      out.invalidDateCount += 1;
      continue;
    }

    // usable row
    out.usableRows += 1;

    if (!r.sex) out.missingSexCount += 1;
    if (r.ageYears === null || r.ageYears === undefined || !Number.isFinite(Number(r.ageYears))) {
      out.missingAgeCount += 1;
    }

    vMin = vMin === null ? v : Math.min(vMin, v);
    vMax = vMax === null ? v : Math.max(vMax, v);

    const wk = toWeekKey(r.testDate);
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
  out.flags.manyInvalid = out.rawCount > 0 ? (invalidTotal / out.rawCount) > 0.05 : false;
  out.flags.smallSample = out.usableRows > 0 ? out.usableRows < 50 : true;
  out.flags.sparseTimeCoverage = out.uniqueWeeks > 0 ? out.uniqueWeeks < 4 : true;

  return out;
}

module.exports = { scanRowsQuality };
