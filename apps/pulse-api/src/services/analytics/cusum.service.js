const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

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

  // HB / anemia special-case (kept for backward compatibility)
  if (st === "anemia" || tc === "HB" || tc === "HGB") {
    return {
      direction: "low",
      isCase: (value, row) => value < anemiaThresholdHb(row?.ageYears, row?.sex),
    };
  }

  // generic clinical thresholds
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

function getWeekKey(d) {
  const x = dayjs(d);
  const y = x.isoWeekYear();
  const w = String(x.isoWeek()).padStart(2, "0");
  return `${y}-W${w}`;
}

function safeNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ✅ General value extractor:
 * 1) Universal: row.value
 * 2) Legacy HB: row.hb / row.hgb
 * 3) Smart fallback: column named after testCode (wbc/crp/plt/...)
 */
function extractValue(row, testCode) {
  // 1) universal schema
  const v = safeNum(row?.value);
  if (v != null) return v;

  // 2) legacy HB/HGB
  const hb = safeNum(row?.hb);
  if (hb != null) return hb;

  const hgb = safeNum(row?.hgb);
  if (hgb != null) return hgb;

  // 3) smart fallback: column equals testCode (case-insensitive)
  const tc = normCode(testCode);
  if (tc) {
    const lowerKey = tc.toLowerCase();
    const directLower = safeNum(row?.[lowerKey]);
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

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/**
 * ✅ Generic CUSUM over weekly CASE rate.
 * Works for any testCode that has a case definition (HB built-in OR CLINICAL thresholds).
 */
function computeSignalCusum({
  rows,
  signalType = "anemia",
  testCode = "HB",
  baselineN = 4,
  k = 0.5,
  h = 5.0,
  lang = "both",
  preset = "standard",
  timeRange = null,
}) {
  const tcNorm = normCode(testCode);
  const caseDef = buildCaseDef({ signalType, testCode: tcNorm });

  if (!caseDef) {
    return {
      cusum: {
        baselineWeeksUsed: 0,
        baselineMean: null,
        baselineStd: null,
        k,
        h,
        direction: null,
        testCode: tcNorm,
        points: [],
      },
      interpretation:
        lang === "both"
          ? {
              ar: "لا توجد عتبات سريرية معرفة لهذا الفحص بعد.",
              en: "No clinical thresholds defined for this test yet.",
            }
          : lang === "ar"
          ? "لا توجد عتبات سريرية معرفة لهذا الفحص بعد."
          : "No clinical thresholds defined for this test yet.",
    };
  }

  const byWeek = new Map();

  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;

    // If row has testCode, enforce match; if not, allow and rely on extractValue fallback.
    const rowCode = r?.testCode ? normCode(r.testCode) : null;
    if (rowCode && tcNorm && rowCode !== tcNorm) continue;

    const v = extractValue(r, tcNorm);
    if (v == null) continue;

    const wk = getWeekKey(dt);
    if (!byWeek.has(wk)) byWeek.set(wk, { n: 0, cases: 0 });
    const g = byWeek.get(wk);

    g.n += 1;
    if (caseDef.isCase(v, r)) g.cases += 1;
  }

  const weeks = Array.from(byWeek.keys()).sort();

  const points = weeks.map((wk) => {
    const g = byWeek.get(wk);
    const rate = g.n > 0 ? g.cases / g.n : 0;

    return {
      week: wk,
      n: g.n,
      low: caseDef.direction === "low" ? g.cases : 0,
      lowRate: caseDef.direction === "low" ? rate : 0,
      high: caseDef.direction === "high" ? g.cases : 0,
      highRate: caseDef.direction === "high" ? rate : 0,
      rate,
    };
  });

  const baseSlice = points.slice(0, Math.max(0, baselineN));
  const baseRates = baseSlice.map((p) => p.rate);
  const baselineMean = mean(baseRates) ?? 0;
  const baselineStd = std(baseRates);

  // one-sided upper CUSUM on standardized rate
  let c = 0;
  const outPoints = points.map((p) => {
    const s = (p.rate - baselineMean) / (baselineStd || 1); // safe if std=0
    c = Math.max(0, c + (s - k));
    const alert = c > h && baselineStd > 0;

    return {
      week: p.week,
      n: p.n,
      low: p.low,
      lowRate: p.lowRate,
      high: p.high,
      highRate: p.highRate,
      s: Number(s.toFixed(4)),
      c: Number(c.toFixed(4)),
      alert,
    };
  });

  const last = outPoints[outPoints.length - 1] || null;

  const interpEn =
    !outPoints.length
      ? `No data available for ${tcNorm}.`
      : `CUSUM tracked weekly ${caseDef.direction.toUpperCase()}-case rate for ${tcNorm}. Latest week ${last.week} has ${last.n} tests; alert=${
          last.alert ? "YES" : "NO"
        }.`;

  const interpAr =
    !outPoints.length
      ? `لا توجد بيانات للفحص ${tcNorm}.`
      : `تم تتبع CUSUM لمعدل الحالات (${caseDef.direction === "high" ? "مرتفع" : "منخفض"}) أسبوعيًا للفحص ${tcNorm}. آخر أسبوع ${last.week} عدد الفحوصات ${last.n}؛ إنذار=${
          last.alert ? "نعم" : "لا"
        }.`;

  return {
    cusum: {
      baselineWeeksUsed: baseSlice.length,
      baselineMean: Number((baselineMean ?? 0).toFixed(4)),
      baselineStd: Number((baselineStd ?? 0).toFixed(4)),
      k,
      h,
      direction: caseDef.direction,
      testCode: tcNorm,
      points: outPoints,
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

// Backward-compatible wrapper
function computeAnemiaCusum(args) {
  return computeSignalCusum({ ...args, signalType: "anemia", testCode: "HB" });
}

module.exports = { computeSignalCusum, computeAnemiaCusum };
