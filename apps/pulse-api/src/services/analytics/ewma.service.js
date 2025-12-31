const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const CLINICAL = require("../../config/clinical.thresholds");

// ===== Helpers =====
function normCode(x) {
  return String(x || "").trim().toUpperCase();
}

function safeNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function getWeekKey(d) {
  const x = dayjs(d);
  const y = x.isoWeekYear();
  const w = String(x.isoWeek()).padStart(2, "0");
  return `${y}-W${w}`;
}

// Accept both shapes: {start,end} OR {from,to}
function normalizeTimeRange(timeRange) {
  if (!timeRange) return null;
  const from = timeRange.from || timeRange.start || null;
  const to = timeRange.to || timeRange.end || null;
  return { from, to };
}

function inRange(dt, timeRange) {
  const tr = normalizeTimeRange(timeRange);
  if (!tr) return true;
  const x = dayjs(dt);
  const from = tr.from ? dayjs(tr.from) : null;
  const to = tr.to ? dayjs(tr.to) : null;
  if (from && x.isBefore(from, "day")) return false;
  if (to && x.isAfter(to, "day")) return false;
  return true;
}

function ageToDays(row) {
  const ad = safeNum(row?.ageDays);
  if (ad != null) return Math.max(0, Math.round(ad));
  const ay = safeNum(row?.ageYears);
  if (ay != null) return Math.max(0, Math.round(ay * 365.25));
  return null;
}

// Supports both band formats:
// - new: {minDays,maxDays}
// - old: {min,max} (ageYears)
function pickBand(bands, ageDays, ageYears) {
  if (!Array.isArray(bands)) return null;

  if (ageDays != null) {
    const b = bands.find(
      (x) =>
        typeof x.minDays === "number" &&
        typeof x.maxDays === "number" &&
        ageDays >= x.minDays &&
        ageDays <= x.maxDays
    );
    if (b) return b;
  }

  if (ageYears != null) {
    const b = bands.find(
      (x) =>
        typeof x.min === "number" &&
        typeof x.max === "number" &&
        ageYears >= x.min &&
        ageYears <= x.max
    );
    if (b) return b;
  }

  return null;
}

function resolveClinicalConfig(testCode) {
  const tc = normCode(testCode);

  // direct
  if (CLINICAL?.[tc] && !CLINICAL[tc]?.aliasOf) return { tc, cfg: CLINICAL[tc] };

  // aliasOf
  if (CLINICAL?.[tc]?.aliasOf) {
    const base = normCode(CLINICAL[tc].aliasOf);
    if (CLINICAL?.[base]) return { tc: base, cfg: CLINICAL[base] };
  }

  // aliases array
  for (const [k, cfg] of Object.entries(CLINICAL || {})) {
    const aliases = (cfg?.aliases || []).map(normCode);
    if (aliases.includes(tc)) return { tc: k, cfg };
  }

  return { tc, cfg: null };
}

function buildCaseDef({ testCode }) {
  const { tc, cfg } = resolveClinicalConfig(testCode);
  if (!cfg) return null;

  const dirRaw = String(cfg.direction || "both").toLowerCase();
  const dir = dirRaw === "high" || dirRaw === "low" || dirRaw === "both" ? dirRaw : "both";

  return {
    direction: dir, // low/high/both
    unit: cfg.unit || null,
    testCode: tc,

    classify(value, row) {
      const v = safeNum(value);
      if (v == null) return null;

      const sex = String(row?.sex || "U").toUpperCase();
      const ageDays = ageToDays(row);
      const ageYears = safeNum(row?.ageYears);

      const bands =
        cfg?.sexBands?.[sex] && Array.isArray(cfg.sexBands[sex]) && cfg.sexBands[sex].length
          ? cfg.sexBands[sex]
          : cfg.bands;

      const band = pickBand(bands, ageDays, ageYears);
      if (!band) return null;

      const lower = typeof band.lower === "number" ? band.lower : null;
      const upper = typeof band.upper === "number" ? band.upper : null;

      const isLow = lower != null ? v < lower : false;
      const isHigh = upper != null ? v > upper : false;

      if (dir === "low") return isLow ? "low" : null;
      if (dir === "high") return isHigh ? "high" : null;

      if (isLow) return "low";
      if (isHigh) return "high";
      return null;
    },
  };
}

function extractValue(row) {
  const v = safeNum(row?.value);
  if (v != null) return v;
  const r = safeNum(row?.result);
  if (r != null) return r;
  const hb = safeNum(row?.hb); // legacy fallback
  if (hb != null) return hb;
  return null;
}

/**
 * ✅ Generic EWMA over weekly out-of-range rate.
 *
 * NEW:
 * - direction "both" supported via classify()
 * - mode: "total" | "high" | "low"
 * - timeRange accepts {start,end} or {from,to}
 */
function computeSignalEwma({
  rows,
  signalType = null, // kept for compatibility with your router
  testCode = "HB",
  lambda = 0.3,
  L = 3,
  baselineN = 4,
  lang = "both",
  preset = "standard",
  timeRange = null,
  mode = "total",
}) {
  const tc = normCode(testCode);
  const caseDef = buildCaseDef({ testCode: tc });

  if (!caseDef) {
    const msgAr = "لا توجد عتبات سريرية معرفة لهذا الفحص بعد.";
    const msgEn = "No clinical thresholds defined for this test yet.";
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
        mode,
        testCode: tc,
        points: [],
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // group by ISO week
  const byWeek = new Map();
  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;
    if (!inRange(dt, timeRange)) continue;

    // enforce testCode if present in row
    const rowCode = r?.testCode ? normCode(r.testCode) : null;
    if (rowCode && rowCode !== tc) continue;

    const v = extractValue(r);
    if (v == null) continue;

    const wk = getWeekKey(dt);
    if (!byWeek.has(wk)) byWeek.set(wk, { n: 0, low: 0, high: 0 });
    const g = byWeek.get(wk);

    g.n += 1;
    const cls = caseDef.classify(v, r);
    if (cls === "low") g.low += 1;
    if (cls === "high") g.high += 1;
  }

  const weeks = Array.from(byWeek.keys()).sort();
  const points = weeks.map((wk) => {
    const g = byWeek.get(wk);
    const n = g.n || 0;
    const lowRate = n ? g.low / n : 0;
    const highRate = n ? g.high / n : 0;

    let rate = 0;
    if (mode === "high") rate = highRate;
    else if (mode === "low") rate = lowRate;
    else rate = n ? (g.low + g.high) / n : 0;

    return {
      week: wk,
      n,
      low: g.low,
      lowRate,
      high: g.high,
      highRate,
      rate, // used by EWMA
    };
  });

  // baseline on first baselineN weeks
  const baseSlice = points.slice(0, Math.max(0, baselineN));
  const baseRates = baseSlice.map((p) => p.rate);
  const baselineMean = mean(baseRates) ?? 0;
  const baselineStd = std(baseRates);

  const sigmaZ = Math.sqrt((lambda / (2 - lambda)) * (baselineStd ** 2));
  const UCL = baselineMean + L * (sigmaZ || 0);

  // EWMA on chosen rate
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
      rate: p.rate,
      z: Number(z.toFixed(4)),
      alert,
    };
  });

  const last = outPoints[outPoints.length - 1] || null;

  const modeLabelEn =
    mode === "high" ? "HIGH-only" : mode === "low" ? "LOW-only" : "out-of-range (LOW+HIGH)";
  const modeLabelAr =
    mode === "high" ? "مرتفع فقط" : mode === "low" ? "منخفض فقط" : "خارج المجال (منخفض+مرتفع)";

  const interpEn =
    !outPoints.length
      ? `No data available for ${tc}.`
      : `EWMA tracked weekly ${modeLabelEn} rate for ${tc}. Latest week ${last.week} has ${last.n} tests; alert=${
          last.alert ? "YES" : "NO"
        }.`;

  const interpAr =
    !outPoints.length
      ? `لا توجد بيانات للفحص ${tc}.`
      : `تم تتبع EWMA لمعدل ${modeLabelAr} أسبوعيًا للفحص ${tc}. آخر أسبوع ${last.week} عدد الفحوصات ${last.n}؛ إنذار=${
          last.alert ? "نعم" : "لا"
        }.`;

  return {
    ewma: {
      lambda,
      L,
      baselineWeeksUsed: baseSlice.length,
      baselineMean: Number((baselineMean ?? 0).toFixed(6)),
      baselineStd: Number((baselineStd ?? 0).toFixed(6)),
      sigmaZ: Number((sigmaZ ?? 0).toFixed(6)),
      UCL: Number((UCL ?? 0).toFixed(6)),
      direction: caseDef.direction,
      mode,
      testCode: tc,
      points: outPoints,
      meta: { unit: caseDef.unit || null, preset },
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

// Backward-compatible wrapper (keeps your router happy)
function computeAnemiaEwma(args) {
  return computeSignalEwma({ ...args, testCode: "HB" });
}

module.exports = { computeSignalEwma, computeAnemiaEwma };
