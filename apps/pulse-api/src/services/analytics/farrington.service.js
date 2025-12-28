const dayjs = require("dayjs");

const CLINICAL = require("../../config/clinical.thresholds");

// ===== Helpers =====
function normCode(x) {
  return String(x || "").trim().toUpperCase();
}

function pickBand(bands, ageYears) {
  const a = typeof ageYears === "number" ? ageYears : Number(ageYears);
  if (!Number.isFinite(a)) return null;
  return (bands || []).find((b) => a >= b.min && a <= b.max) || null;
}

// Hb anemia rule (legacy kept)
function anemiaThresholdHb(ageYears, sex) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  const s = String(sex || "U").toUpperCase();
  if (age !== null && age >= 5 && age <= 14) return 11.5;
  if (age !== null && age >= 15) {
    if (s === "F") return 12.0;
    if (s === "M") return 13.0;
    return 11.5;
  }
  return 11.0;
}

function buildCaseDef({ signalType, testCode }) {
  const st = String(signalType || "").toLowerCase();
  const tc = normCode(testCode);

  // anemia / Hb special-case
  if (st === "anemia" || tc === "HB" || tc === "HGB") {
    return {
      direction: "low",
      isCase: (value, row) => value < anemiaThresholdHb(row?.ageYears, row?.sex),
    };
  }

  const cfg = CLINICAL?.[tc] || null;
  if (!cfg) return null;

  const dir = String(cfg.direction || "high").toLowerCase() === "low" ? "low" : "high";

  return {
    direction: dir,
    isCase: (value, row) => {
      const band = pickBand(cfg.bands, row?.ageYears);
      if (!band) return false;

      if (dir === "high") {
        const u = typeof band.upper === "number" ? band.upper : null;
        if (u == null) return false;
        return value > u;
      }

      const l = typeof band.lower === "number" ? band.lower : null;
      if (l == null) return false;
      return value < l;
    },
  };
}

function safeNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ✅ Universal value extractor:
 * 1) row.value (universal schema)
 * 2) legacy hb/hgb
 * 3) fallback: column named after testCode (wbc/crp/plt...)
 */
function extractValue(row, testCode) {
  const v = safeNum(row?.value);
  if (v != null) return v;

  const hb = safeNum(row?.hb);
  if (hb != null) return hb;

  const hgb = safeNum(row?.hgb);
  if (hgb != null) return hgb;

  const tc = normCode(testCode);
  if (tc) {
    const k1 = tc.toLowerCase();
    const directLower = safeNum(row?.[k1]);
    if (directLower != null) return directLower;

    const directUpper = safeNum(row?.[tc]);
    if (directUpper != null) return directUpper;
  }

  return null;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// month key: YYYY-MM
function getMonthKey(d) {
  const x = dayjs(d);
  if (!x.isValid()) return null;
  return x.format("YYYY-MM");
}

function parseMonthKey(k) {
  // k = "YYYY-MM"
  const x = dayjs(`${k}-01`);
  return x.isValid() ? x : null;
}

function monthOfYear(k) {
  const x = parseMonthKey(k);
  if (!x) return null;
  return x.month() + 1; // 1..12
}

function addMonthsToMonthKey(k, deltaMonths) {
  const x = parseMonthKey(k);
  if (!x) return null;
  return x.add(deltaMonths, "month").format("YYYY-MM");
}

/**
 * Build seasonal baseline month-of-year set around target month
 * e.g. windowMonths=1 => [prevMonthOfYear, sameMonth, nextMonthOfYear]
 * We implement this as month shifting on the actual calendar month key.
 */
function seasonalWindowMonthKeys(targetMonthKey, windowMonths) {
  const keys = [];
  for (let dm = -windowMonths; dm <= windowMonths; dm++) {
    const k = addMonthsToMonthKey(targetMonthKey, dm);
    if (k) keys.push(k);
  }
  return keys;
}

/**
 * ✅ Monthly Farrington-like, "global-style":
 * - Aggregate into months: month -> { n, cases }
 * - For each target month:
 *   Baseline = same seasonal window months, from ALL previous years only (i.e., earlier than target month).
 *   expected = mean(baselineCounts) (conservative Poisson-ish)
 *   UCL = expected + z * sqrt(expected) * phi   (phi default 1; can inflate later)
 *
 * Data sufficiency:
 * - require at least minBaselinePoints baseline months to compute expected/UCL
 * - require at least minHistoryYears distinct years contributing baseline
 */
function computeSignalFarrington({
  rows,
  signalType = "anemia",
  testCode = "HB",
  z = 2.0,

  // Monthly / seasonality parameters
  windowMonths = 1,          // same month ± 1 month (seasonal window)
  minBaselinePoints = 8,     // minimum baseline months across prior years
  minHistoryYears = 2,       // need at least 2 different years in baseline
  phi = 1,                   // dispersion placeholder (keep 1 for now)

  lang = "both",
  preset = "standard",
  timeRange = null,
}) {
  const tcNorm = normCode(testCode);
  const caseDef = buildCaseDef({ signalType, testCode: tcNorm });

  if (!caseDef) {
    return {
      farrington: {
        z,
        yearsBack: "ALL",
        windowMonths,
        minBaselinePoints,
        minHistoryYears,
        phi,
        direction: null,
        testCode: tcNorm,
        points: [],
        granularity: "MONTH",
      },
      interpretation:
        lang === "both"
          ? { ar: "لا توجد عتبات سريرية معرفة لهذا الفحص بعد.", en: "No clinical thresholds defined for this test yet." }
          : lang === "ar"
          ? "لا توجد عتبات سريرية معرفة لهذا الفحص بعد."
          : "No clinical thresholds defined for this test yet.",
    };
  }

  // 1) Aggregate rows into monthly buckets
  const byMonth = new Map(); // "YYYY-MM" -> { n, cases }
  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;

    // enforce testCode if present
    const rowCode = r?.testCode ? normCode(r.testCode) : null;
    if (rowCode && tcNorm && rowCode !== tcNorm) continue;

    const v = extractValue(r, tcNorm);
    if (v == null) continue;

    const mk = getMonthKey(dt);
    if (!mk) continue;

    if (!byMonth.has(mk)) byMonth.set(mk, { n: 0, cases: 0 });
    const g = byMonth.get(mk);

    g.n += 1;
    if (caseDef.isCase(v, r)) g.cases += 1;
  }

  const months = Array.from(byMonth.keys()).sort(); // chronological
  if (!months.length) {
    const msgEn = `No data available for ${tcNorm}.`;
    const msgAr = `لا توجد بيانات للفحص ${tcNorm}.`;
    return {
      farrington: {
        z,
        yearsBack: "ALL",
        windowMonths,
        minBaselinePoints,
        minHistoryYears,
        phi,
        direction: caseDef.direction,
        testCode: tcNorm,
        points: [],
        granularity: "MONTH",
        dataSufficiency: { ok: false, reason: "NO_MONTHS" },
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // helper: get month year
  function yearOfMonthKey(k) {
    const x = parseMonthKey(k);
    return x ? x.year() : null;
  }

  // 2) For each month, compute baseline from ALL previous years using seasonal window
  const points = months.map((curMonthKey, idx) => {
    const cur = byMonth.get(curMonthKey);
    const curYear = yearOfMonthKey(curMonthKey);

    // baseline candidates: for each previous month in series (strictly earlier than current month)
    // include if that previous month is in the seasonal window around current month-of-year.
    const windowKeysForCurrent = new Set(seasonalWindowMonthKeys(curMonthKey, windowMonths).map((k) => monthOfYear(k)));

    const baseline = [];
    const baselineYears = new Set();

    for (let j = 0; j < idx; j++) {
      const prevMonthKey = months[j];
      const prevYear = yearOfMonthKey(prevMonthKey);
      const prevMOY = monthOfYear(prevMonthKey);
      if (prevMOY == null) continue;

      // same seasonal window months (by month-of-year match)
      if (windowKeysForCurrent.has(prevMOY)) {
        baseline.push(byMonth.get(prevMonthKey).cases);
        if (prevYear != null) baselineYears.add(prevYear);
      }
    }

    const baselineUsed = baseline.length;
    const yearsUsed = baselineYears.size;

    // data sufficiency per month
    const ok = baselineUsed >= minBaselinePoints && yearsUsed >= minHistoryYears;

    const expected = ok ? (mean(baseline) ?? 0.1) : null;
    const safeExpected = ok ? Math.max(expected, 0.1) : null;

    // Poisson-ish UCL with optional dispersion phi
    const UCL = ok ? safeExpected + z * Math.sqrt(safeExpected) * (Number(phi) || 1) : null;

    const alert = ok ? cur.cases > UCL : false;

    return {
      month: curMonthKey, // YYYY-MM
      n: cur.n,
      low: caseDef.direction === "low" ? cur.cases : 0,
      high: caseDef.direction === "high" ? cur.cases : 0,
      expected: ok ? Number(expected.toFixed(2)) : null,
      phi: Number(phi) || 1,
      UCL: ok ? Number(UCL.toFixed(2)) : null,
      baselineUsed,
      baselineYearsUsed: yearsUsed,
      ok,
      alert,
    };
  });

  // 3) Global sufficiency (for UI message): do we have at least one point ok?
  const okPoints = points.filter((p) => p.ok);
  const last = points[points.length - 1] || null;

  if (!okPoints.length) {
    const msgEn = `Insufficient data to run monthly Farrington for ${tcNorm}: need at least ${minHistoryYears} history years and ${minBaselinePoints} baseline months (same months across previous years).`;
    const msgAr = `لا توجد بيانات كافية لتشغيل Farrington الشهري للفحص ${tcNorm}: يلزم على الأقل ${minHistoryYears} سنوات تاريخية و${minBaselinePoints} أشهر كخط أساس (نفس الأشهر عبر السنوات السابقة).`;

    return {
      farrington: {
        z,
        yearsBack: "ALL",
        windowMonths,
        minBaselinePoints,
        minHistoryYears,
        phi,
        direction: caseDef.direction,
        testCode: tcNorm,
        points,
        granularity: "MONTH",
        dataSufficiency: {
          ok: false,
          reason: "NOT_ENOUGH_HISTORY",
          monthsTotal: points.length,
          okMonths: okPoints.length,
        },
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // interpretation: focus on last month
  const lastCases = caseDef.direction === "high" ? last.high : last.low;

  const interpEn =
    !points.length
      ? `No data available for ${tcNorm}.`
      : !last.ok
      ? `Monthly Farrington (${tcNorm}) not computed for ${last.month}: insufficient seasonal history (need same months across previous years).`
      : `Monthly Farrington-style check on ${caseDef.direction.toUpperCase()} cases for ${tcNorm}. Latest month ${last.month}: cases=${lastCases}, UCL=${last.UCL}, alert=${last.alert ? "YES" : "NO"}.`;

  const interpAr =
    !points.length
      ? `لا توجد بيانات للفحص ${tcNorm}.`
      : !last.ok
      ? `لم يتم حساب Farrington الشهري للفحص ${tcNorm} في شهر ${last.month}: لا توجد بيانات موسمية كافية (نفس الأشهر عبر السنوات السابقة).`
      : `تم فحص Farrington (شهري/موسمي) لعدد الحالات (${caseDef.direction === "high" ? "مرتفع" : "منخفض"}) للفحص ${tcNorm}. آخر شهر ${last.month}: الحالات=${lastCases}، الحد الأعلى ${last.UCL}، إنذار=${last.alert ? "نعم" : "لا"}.`;

  return {
    farrington: {
      z,
      yearsBack: "ALL",
      windowMonths,
      minBaselinePoints,
      minHistoryYears,
      phi,
      direction: caseDef.direction,
      testCode: tcNorm,
      points,
      granularity: "MONTH",
      dataSufficiency: {
        ok: true,
        rule: `Seasonal baseline from ALL previous years using same month ± ${windowMonths} month(s); minBaselinePoints=${minBaselinePoints}, minHistoryYears=${minHistoryYears}`,
      },
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

function computeAnemiaFarrington(args) {
  return computeSignalFarrington({ ...args, signalType: "anemia", testCode: "HB" });
}

module.exports = { computeSignalFarrington, computeAnemiaFarrington };
