// apps/pulse-api/src/services/analytics/cusum.service.js

const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const DEFAULTS = require("../../config/analytics.defaults");
const CLINICAL = require("../../config/clinical.thresholds");

// ----------------------------
// helpers
// ----------------------------
function normCode(x) {
  return String(x || "").trim().toUpperCase();
}

function safeNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampNum(x, min, max) {
  const n = safeNum(x);
  if (n == null) return null;
  return Math.min(max, Math.max(min, n));
}

function clampInt(x, min, max) {
  const n = safeNum(x);
  if (n == null) return null;
  const k = Math.round(n);
  return Math.min(max, Math.max(min, k));
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

// Accept both shapes:
// - {start,end} from your router
// - {from,to} from newer services
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

function resolveClinicalConfig(testCode) {
  const tc = normCode(testCode);
  if (CLINICAL?.[tc] && !CLINICAL[tc]?.aliasOf) return { tc, cfg: CLINICAL[tc] };

  // aliasOf support
  if (CLINICAL?.[tc]?.aliasOf) {
    const base = normCode(CLINICAL[tc].aliasOf);
    if (CLINICAL?.[base]) return { tc: base, cfg: CLINICAL[base] };
  }

  // aliases array support
  for (const [k, cfg] of Object.entries(CLINICAL || {})) {
    const aliases = (cfg?.aliases || []).map(normCode);
    if (aliases.includes(tc)) return { tc: k, cfg };
  }

  return { tc, cfg: null };
}

// Supports both band formats (for safety):
// - new: {minDays,maxDays}
// - old: {min,max} (ageYears)
function pickBand(bands, ageDays, ageYears) {
  if (!Array.isArray(bands)) return null;

  if (ageDays != null) {
    const b = bands.find((x) => typeof x.minDays === "number" && ageDays >= x.minDays && ageDays <= x.maxDays);
    if (b) return b;
  }
  if (ageYears != null) {
    const b = bands.find((x) => typeof x.min === "number" && ageYears >= x.min && ageYears <= x.max);
    if (b) return b;
  }
  return null;
}

function buildCaseDef(testCode) {
  const { tc, cfg } = resolveClinicalConfig(testCode);
  if (!cfg) return null;

  const dirRaw = String(cfg.direction || "both").toLowerCase();
  const dir = dirRaw === "high" || dirRaw === "low" || dirRaw === "both" ? dirRaw : "both";

  return {
    testCode: tc,
    direction: dir,
    unit: cfg.unit || null,

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

      // both
      if (isLow) return "low";
      if (isHigh) return "high";
      return null;
    },
  };
}

function extractValue(row) {
  // your DB rows already map to { value }
  const v = safeNum(row?.value);
  if (v != null) return v;
  // extra fallbacks if needed
  const r = safeNum(row?.result);
  if (r != null) return r;
  return null;
}

function getCusumConfig({ preset = "standard", testCode = null, overrides = null }) {
  const G = DEFAULTS?.global || DEFAULTS?.anemia || {};
  const bounds = G?.bounds?.cusum || {
    baselineN: { min: 4, max: 26 },
    k: { min: 0.1, max: 1.0 },
    h: { min: 2.0, max: 10.0 },
  };

  const presetName = String(preset || G.defaultPreset || "standard").toLowerCase();
  const base = G?.presets?.[presetName]?.cusum || G?.presets?.standard?.cusum || { baselineN: 6, k: 0.5, h: 5.0 };

  const tc = testCode ? normCode(testCode) : null;
  const testPreset = tc ? DEFAULTS?.byTestCode?.[tc]?.presets?.[presetName]?.cusum : null;

  const merged = {
    baselineN: overrides?.baselineN ?? testPreset?.baselineN ?? base.baselineN,
    k: overrides?.k ?? testPreset?.k ?? base.k,
    h: overrides?.h ?? testPreset?.h ?? base.h,
  };

  return {
    baselineN: clampInt(merged.baselineN, bounds.baselineN.min, bounds.baselineN.max),
    k: clampNum(merged.k, bounds.k.min, bounds.k.max),
    h: clampNum(merged.h, bounds.h.min, bounds.h.max),
  };
}

/**
 * ✅ Professional CUSUM on weekly out-of-range rate.
 *
 * Keeps backward compatibility with your router signature:
 * - accepts signalType (ignored)
 * - accepts timeRange in {start,end} or {from,to}
 */
function computeSignalCusum({
  rows,
  signalType = null, // kept for compatibility
  testCode,
  preset = "standard",
  timeRange = null,
  lang = "both",

  // allow router to pass baselineN,k,h
  baselineN: baselineNIn,
  k: kIn,
  h: hIn,

  // optional new param
  mode = "total", // "total" | "high" | "low"
}) {
  const tc = normCode(testCode);
  const caseDef = buildCaseDef(tc);

  if (!caseDef) {
    const msgAr = `لا توجد عتبات سريرية معرفة للفحص ${tc} بعد.`;
    const msgEn = `No clinical thresholds defined for ${tc} yet.`;
    return {
      cusum: {
        testCode: tc,
        direction: null,
        preset,
        mode,
        baselineWeeksUsed: 0,
        baselineMean: null,
        baselineStd: null,
        k: null,
        h: null,
        points: [],
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  const cfg = getCusumConfig({
    preset,
    testCode: tc,
    overrides: { baselineN: baselineNIn, k: kIn, h: hIn },
  });

  const byWeek = new Map();

  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;
    if (!inRange(dt, timeRange)) continue;

    // rows already filtered by testCode in DB query, but keep safe:
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
  if (!weeks.length) {
    const msgAr = `لا توجد بيانات كافية للفحص ${tc}.`;
    const msgEn = `No data available for ${tc}.`;
    return {
      cusum: {
        testCode: tc,
        direction: caseDef.direction,
        preset,
        mode,
        baselineWeeksUsed: 0,
        baselineMean: null,
        baselineStd: null,
        k: cfg.k,
        h: cfg.h,
        points: [],
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  const pointsRaw = weeks.map((week) => {
    const g = byWeek.get(week);
    const n = g.n || 0;
    const lowRate = n ? g.low / n : 0;
    const highRate = n ? g.high / n : 0;

    let rate = 0;
    if (mode === "high") rate = highRate;
    else if (mode === "low") rate = lowRate;
    else rate = n ? (g.low + g.high) / n : 0;

    return {
      week,
      n,
      low: g.low,
      high: g.high,
      lowRate,
      highRate,
      rate,
    };
  });

  const baseSlice = pointsRaw.slice(0, Math.max(0, cfg.baselineN));
  const baseRates = baseSlice.map((p) => p.rate);
  const baselineMean = mean(baseRates) ?? 0;
  const baselineStd = std(baseRates);

  // upper one-sided CUSUM on standardized deviation
  let c = 0;
  const outPoints = pointsRaw.map((p) => {
    const s = (p.rate - baselineMean) / (baselineStd || 1);
    c = Math.max(0, c + (s - cfg.k));
    const alert = baselineStd > 0 ? c > cfg.h : false;

    return {
      week: p.week,
      n: p.n,
      low: p.low,
      lowRate: p.lowRate,
      high: p.high,
      highRate: p.highRate,
      rate: p.rate,
      s: Number(s.toFixed(4)),
      c: Number(c.toFixed(4)),
      alert,
    };
  });

  const last = outPoints[outPoints.length - 1];

  const modeLabelEn = mode === "high" ? "HIGH-only" : mode === "low" ? "LOW-only" : "out-of-range (LOW+HIGH)";
  const modeLabelAr = mode === "high" ? "مرتفع فقط" : mode === "low" ? "منخفض فقط" : "خارج المجال (منخفض+مرتفع)";

  const interpEn = `CUSUM tracked weekly ${modeLabelEn} rate for ${tc}. Latest ${last.week}: n=${last.n}, alert=${last.alert ? "YES" : "NO"}.`;
  const interpAr = `تم تتبع CUSUM لمعدل ${modeLabelAr} أسبوعيًا للفحص ${tc}. آخر أسبوع ${last.week}: عدد=${last.n}، إنذار=${last.alert ? "نعم" : "لا"}.`;

  return {
    cusum: {
      testCode: tc,
      direction: caseDef.direction,
      preset,
      mode,
      baselineWeeksUsed: baseSlice.length,
      baselineMean: Number(baselineMean.toFixed(6)),
      baselineStd: Number(baselineStd.toFixed(6)),
      k: cfg.k,
      h: cfg.h,
      points: outPoints,
      meta: { unit: caseDef.unit || null },
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

// ✅ backward compatible alias
function computeAnemiaCusum(args) {
  return computeSignalCusum({ ...args, testCode: "HB" });
}

module.exports = { computeSignalCusum, computeAnemiaCusum };
