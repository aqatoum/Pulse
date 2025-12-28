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

// Hb anemia rule (legacy fallback)
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

// NEW: allow HB thresholds from CLINICAL if present (mode ageSex)
function anemiaThresholdFromClinical(cfg, ageYears, sex) {
  if (!cfg || cfg.mode !== "ageSex" || !cfg.thresholds) return null;

  const age = typeof ageYears === "number" ? ageYears : Number(ageYears);
  const s = String(sex || "U").toUpperCase();

  // use WHO-aligned keys (simplified)
  if (Number.isFinite(age)) {
    if (age < 5) return Number(cfg.thresholds.child_under_5);
    if (age >= 5 && age <= 11) return Number(cfg.thresholds.child_5_11);
    if (age >= 12 && age <= 14) return Number(cfg.thresholds.adolescent_12_14);
    if (age >= 15) {
      if (s === "F") return Number(cfg.thresholds.adult_female);
      if (s === "M") return Number(cfg.thresholds.adult_male);
      // if unknown sex, be conservative:
      return Number(cfg.thresholds.adolescent_12_14 ?? cfg.thresholds.child_5_11);
    }
  }

  return null;
}

function buildCaseDef({ signalType, testCode }) {
  const st = String(signalType || "").toLowerCase();
  const tc = normCode(testCode);

  // ✅ Prefer CLINICAL definition if exists (including HB via mode ageSex)
  const cfg = CLINICAL?.[tc] || null;

  // HB / anemia
  if (st === "anemia" || tc === "HB" || tc === "HGB") {
    return {
      direction: "low",
      isCase: (value, row) => {
        const thrFromCfg = anemiaThresholdFromClinical(cfg, row?.ageYears, row?.sex);
        const thr = Number.isFinite(thrFromCfg) ? thrFromCfg : anemiaThresholdHb(row?.ageYears, row?.sex);
        return value < thr;
      },
    };
  }

  // Other tests must have config
  if (!cfg) return null;

  const dir = String(cfg.direction || "high").toLowerCase() === "low" ? "low" : "high";

  return {
    direction: dir,
    isCase: (value, row) => {
      // If cfg has bands, use banded thresholds
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
 * ✅ Universal value extractor:
 * 1) row.value
 * 2) legacy hb/hgb
 * 3) smart fallback: column named by testCode (wbc/crp/plt/...)
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

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/**
 * ✅ Generic EWMA over weekly CASE rate.
 * rows must contain: { testDate|collectedAt, value|<testCode column>, ageYears, sex, testCode? }
 */
function computeSignalEwma({
  rows,
  signalType = "anemia",
  testCode = "HB",
  lambda = 0.3,
  L = 3,
  baselineN = 4,
  lang = "both",
  preset = "standard",
  timeRange = null,
}) {
  const tcNorm = normCode(testCode);

  const caseDef = buildCaseDef({ signalType, testCode: tcNorm });
  if (!caseDef) {
    return {
      ewma: {
        lambda,
        L,
        baselineWeeksUsed: 0,
        baselineMean: null,
        baselineStd: null,
        sigmaZ: null,
        UCL: null,
        direction: null,
        testCode: tcNorm,
        points: [],
      },
      interpretation:
        lang === "both"
          ? { ar: "لا توجد عتبات سريرية معرفة لهذا الفحص بعد.", en: "No clinical thresholds defined for this test yet." }
          : lang === "ar"
          ? "لا توجد عتبات سريرية معرفة لهذا الفحص بعد."
          : "No clinical thresholds defined for this test yet.",
    };
  }

  // group by ISO week
  const byWeek = new Map();
  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;

    // enforce testCode if present in row (universal schema)
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

  // baseline on first baselineN weeks
  const baseSlice = points.slice(0, Math.max(0, baselineN));
  const baseRates = baseSlice.map((p) => p.rate);
  const baselineMean = mean(baseRates) ?? 0;
  const baselineStd = std(baseRates);

  const sigmaZ = Math.sqrt((lambda / (2 - lambda)) * (baselineStd ** 2));
  const UCL = baselineMean + L * (sigmaZ || 0);

  // EWMA
  let z = baselineMean;
  const outPoints = points.map((p, idx) => {
    if (idx === 0) z = baselineMean;
    z = lambda * p.rate + (1 - lambda) * z;
    const alert = sigmaZ > 0 ? z > UCL : false;

    return {
      week: p.week,
      n: p.n,
      low: p.low,
      lowRate: p.lowRate,
      high: p.high,
      highRate: p.highRate,
      z: Number(z.toFixed(4)),
      alert,
    };
  });

  const last = outPoints[outPoints.length - 1] || null;

  const interpEn =
    !outPoints.length
      ? `No data available for ${tcNorm}.`
      : `EWMA tracked weekly ${caseDef.direction.toUpperCase()}-case rate for ${tcNorm}. Latest week ${last.week} has ${last.n} tests; alert=${last.alert ? "YES" : "NO"}.`;

  const interpAr =
    !outPoints.length
      ? `لا توجد بيانات للفحص ${tcNorm}.`
      : `تم تتبع EWMA لمعدل الحالات (${caseDef.direction === "high" ? "مرتفع" : "منخفض"}) أسبوعيًا للفحص ${tcNorm}. آخر أسبوع ${last.week} عدد الفحوصات ${last.n}؛ إنذار=${last.alert ? "نعم" : "لا"}.`;

  return {
    ewma: {
      lambda,
      L,
      baselineWeeksUsed: baseSlice.length,
      baselineMean: Number((baselineMean ?? 0).toFixed(4)),
      baselineStd: Number((baselineStd ?? 0).toFixed(4)),
      sigmaZ: Number((sigmaZ ?? 0).toFixed(4)),
      UCL: Number((UCL ?? 0).toFixed(4)),
      direction: caseDef.direction,
      testCode: tcNorm,
      points: outPoints,
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

// Backward-compatible wrapper
function computeAnemiaEwma(args) {
  return computeSignalEwma({ ...args, signalType: "anemia", testCode: "HB" });
}

module.exports = { computeSignalEwma, computeAnemiaEwma };
