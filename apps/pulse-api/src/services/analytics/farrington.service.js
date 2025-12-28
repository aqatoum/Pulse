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

function extractValue(row) {
  const v = safeNum(row?.value);
  if (v != null) return v;
  const hb = safeNum(row?.hb);
  if (hb != null) return hb;
  return null;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * ✅ Simplified Farrington-like:
 * - compute weekly CASE counts (not rates)
 * - baseline expected = mean of historic counts (weeksBack window)
 * - UCL = expected + z*sqrt(expected) (Poisson-ish)
 *
 * This keeps your current output shape and "baselineUsed" behavior.
 */
function computeSignalFarrington({
  rows,
  signalType = "anemia",
  testCode = "HB",
  baselineWeeks = 8,
  z = 2.0,
  lang = "both",
  preset = "standard",
  timeRange = null,
}) {
  const caseDef = buildCaseDef({ signalType, testCode });
  if (!caseDef) {
    return {
      farrington: {
        baselineWeeks,
        z,
        yearsBack: 2,
        windowWeeks: 2,
        minBaselinePoints: 6,
        direction: null,
        testCode: normCode(testCode),
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

  // weekly counts
  const byWeek = new Map();
  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;

    const rowCode = r?.testCode ? normCode(r.testCode) : null;
    if (rowCode && normCode(testCode) && rowCode !== normCode(testCode)) continue;

    const v = extractValue(r);
    if (v == null) continue;

    const wk = getWeekKey(dt);
    if (!byWeek.has(wk)) byWeek.set(wk, { n: 0, cases: 0 });
    const g = byWeek.get(wk);

    g.n += 1;
    if (caseDef.isCase(v, r)) g.cases += 1;
  }

  const weeks = Array.from(byWeek.keys()).sort();
  const series = weeks.map((wk) => {
    const g = byWeek.get(wk);
    return { week: wk, n: g.n, cases: g.cases };
  });

  const points = series.map((cur, idx) => {
    const start = Math.max(0, idx - baselineWeeks);
    const base = series.slice(start, idx).map((p) => p.cases);
    const expected = mean(base) ?? 0.1;
    const UCL = expected + z * Math.sqrt(Math.max(expected, 0));
    const alert = idx > 0 ? cur.cases > UCL : false;

    return {
      week: cur.week,
      n: cur.n,
      low: caseDef.direction === "low" ? cur.cases : 0,
      high: caseDef.direction === "high" ? cur.cases : 0,
      expected: Number(expected.toFixed(2)),
      phi: 1,
      UCL: Number(UCL.toFixed(2)),
      baselineUsed: base.length,
      alert,
    };
  });

  const last = points[points.length - 1] || null;

  const interpEn =
    !points.length
      ? `No data available for ${normCode(testCode)}.`
      : `Farrington-style check on weekly ${caseDef.direction.toUpperCase()} cases for ${normCode(
          testCode
        )}. Latest week ${last.week}: cases=${caseDef.direction === "high" ? last.high : last.low}, UCL=${
          last.UCL
        }, alert=${last.alert ? "YES" : "NO"}.`;

  const interpAr =
    !points.length
      ? `لا توجد بيانات للفحص ${normCode(testCode)}.`
      : `تم فحص Farrington (مبسّط) لعدد الحالات (${caseDef.direction === "high" ? "مرتفع" : "منخفض"}) أسبوعيًا للفحص ${normCode(
          testCode
        )}. آخر أسبوع ${last.week}: الحالات=${caseDef.direction === "high" ? last.high : last.low}، الحد الأعلى ${
          last.UCL
        }، إنذار=${last.alert ? "نعم" : "لا"}.`;

  return {
    farrington: {
      baselineWeeks,
      z,
      yearsBack: 2,
      windowWeeks: 2,
      minBaselinePoints: 6,
      direction: caseDef.direction,
      testCode: normCode(testCode),
      points,
    },
    interpretation:
      lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

function computeAnemiaFarrington(args) {
  return computeSignalFarrington({ ...args, signalType: "anemia", testCode: "HB" });
}

module.exports = { computeSignalFarrington, computeAnemiaFarrington };
