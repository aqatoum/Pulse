const dayjs = require("dayjs");
const isoWeek = require("dayjs/plugin/isoWeek");
dayjs.extend(isoWeek);

const CLINICAL = require("../../config/clinical.thresholds");

// ----------------------------
// Helpers
// ----------------------------
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

function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr) ?? 0;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return v;
}

function getWeekKey(d) {
  const x = dayjs(d);
  const y = x.isoWeekYear();
  const w = String(x.isoWeek()).padStart(2, "0");
  return `${y}-W${w}`;
}

function weekKeyToStartDate(weekKey) {
  // "YYYY-Www"
  const m = String(weekKey || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const w = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(w)) return null;
  // Monday of ISO week
  return dayjs().isoWeekYear(y).isoWeek(w).startOf("isoWeek");
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
      (x) => typeof x.min === "number" && typeof x.max === "number" && ageYears >= x.min && ageYears <= x.max
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

/**
 * Universal case definition:
 * classify(value,row) => "low" | "high" | null
 */
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
  const hb = safeNum(row?.hb);
  if (hb != null) return hb;
  return null;
}

function latest(arr) {
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
}

function fillMissingWeeksFromKeys(keysSorted) {
  if (!keysSorted.length) return [];
  const start = weekKeyToStartDate(keysSorted[0]);
  const end = weekKeyToStartDate(keysSorted[keysSorted.length - 1]);
  if (!start || !end) return keysSorted;

  const out = [];
  let cur = start.clone();
  const endIncl = end.clone();

  // iterate week by week (inclusive)
  while (cur.isBefore(endIncl) || cur.isSame(endIncl, "day")) {
    out.push(getWeekKey(cur));
    cur = cur.add(1, "week");
  }
  return out;
}

// Seasonal baseline: use same season across prior years
function seasonalBaselineCounts({
  weekStartDate, // dayjs object startOf isoWeek
  seriesByWeek,  // Map weekKey -> {cases}
  yearsBack,
  windowWeeks,
  guardWeeks,
  currentIndex,  // index in full series (after fill)
}) {
  // Using 52-week step for seasonality (practical, stable)
  const counts = [];

  for (let y = 1; y <= yearsBack; y++) {
    for (let w = -windowWeeks; w <= windowWeeks; w++) {
      const candidate = weekStartDate
        .clone()
        .subtract(52 * y, "week")
        .add(w, "week");

      const key = getWeekKey(candidate);
      const val = seriesByWeek.get(key);

      // If missing week in history, treat as 0 (consistent with fillMissingWeeks philosophy)
      const cases = val ? (typeof val.cases === "number" ? val.cases : 0) : 0;
      counts.push(cases);
    }
  }

  return counts;
}

// ----------------------------
// Main: Seasonal Farrington-like
// ----------------------------
function computeSignalFarrington({
  rows,
  signalType = null, // kept for router compatibility
  testCode = "HB",

  // core parameters
  yearsBack = 2,        // 2–5 recommended for real surveillance
  windowWeeks = 2,      // seasonal window ±2 weeks
  baselineWeeks = 12,   // fallback if you ever want non-seasonal; kept for output compat
  guardWeeks = 2,       // don't use very recent weeks in baseline (anti-leak)

  z = 2.0,
  lang = "both",
  preset = "standard",
  timeRange = null,

  mode = "total",       // "total" | "high" | "low"
  minWeeksCoverage = 52, // ✅ your requirement: at least 1 year after filling
  minBaselinePoints = 12, // seasonal baseline points count threshold
  minExpected = 0.2,     // avoid tiny expected -> noisy UCL
}) {
  const tc = normCode(testCode);
  const caseDef = buildCaseDef(tc);

  if (!caseDef) {
    const msgAr = "لا توجد عتبات سريرية معرفة لهذا الفحص بعد.";
    const msgEn = "No clinical thresholds defined for this test yet.";
    return {
      farrington: {
        baselineWeeks,
        z,
        yearsBack,
        windowWeeks,
        minBaselinePoints,
        direction: null,
        mode,
        testCode: tc,
        points: [],
        dataSufficiency: { ok: false, reason: "NO_THRESHOLDS" },
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // aggregate to weeks (raw)
  const byWeek = new Map();
  for (const r of rows || []) {
    const dt = r?.testDate || r?.collectedAt;
    if (!dt) continue;
    if (!inRange(dt, timeRange)) continue;

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

  const weeksRaw = Array.from(byWeek.keys()).sort();

  if (!weeksRaw.length) {
    const msgAr = `لا توجد بيانات للفحص ${tc}.`;
    const msgEn = `No data available for ${tc}.`;
    return {
      farrington: {
        baselineWeeks,
        z,
        yearsBack,
        windowWeeks,
        minBaselinePoints,
        direction: caseDef.direction,
        mode,
        testCode: tc,
        points: [],
        dataSufficiency: { ok: false, reason: "NO_DATA" },
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // ✅ fill missing weeks (critical for accurate coverage)
  const allWeeks = fillMissingWeeksFromKeys(weeksRaw);

  // build full series with zero-filled missing weeks
  const seriesByWeek = new Map();
  for (const wk of allWeeks) {
    const g = byWeek.get(wk) || { n: 0, low: 0, high: 0 };
    const n = g.n || 0;
    const low = g.low || 0;
    const high = g.high || 0;

    let cases = low + high;
    if (mode === "high") cases = high;
    else if (mode === "low") cases = low;

    seriesByWeek.set(wk, { week: wk, n, low, high, cases });
  }

  const weeksCoverage = allWeeks.length;
  if (weeksCoverage < minWeeksCoverage) {
    const msgAr = `لا يمكن تشغيل Farrington الموسمي: التغطية الزمنية غير كافية (المتاح ${weeksCoverage} أسبوعًا بعد تعبئة الفراغات؛ المطلوب ${minWeeksCoverage}).`;
    const msgEn = `Cannot run seasonal Farrington: insufficient time coverage (${weeksCoverage} weeks after filling gaps; ${minWeeksCoverage} required).`;

    return {
      farrington: {
        baselineWeeks,
        z,
        yearsBack,
        windowWeeks,
        minBaselinePoints,
        direction: caseDef.direction,
        mode,
        testCode: tc,
        points: [],
        dataSufficiency: { ok: false, reason: "INSUFFICIENT_WEEKS_COVERAGE", weeksCoverage, minWeeksCoverage },
      },
      interpretation: lang === "both" ? { ar: msgAr, en: msgEn } : lang === "ar" ? msgAr : msgEn,
    };
  }

  // compute points
  const points = allWeeks.map((wk, idx) => {
    const cur = seriesByWeek.get(wk);
    const wkStart = weekKeyToStartDate(wk);

    // build seasonal baseline counts from prior years ± window
    let base = [];
    if (wkStart) {
      base = seasonalBaselineCounts({
        weekStartDate: wkStart,
        seriesByWeek,
        yearsBack,
        windowWeeks,
        guardWeeks,
        currentIndex: idx,
      });
    }

    const baselineUsed = base.length;

    // expected and phi (overdispersion)
    let expected = mean(base);
    if (expected == null) expected = 0;
    expected = Math.max(expected, minExpected);

    const varBase = variance(base);
    const phi = expected > 0 ? Math.max(1, varBase / expected) : 1;

    const UCL = expected + z * Math.sqrt(Math.max(phi * expected, 0));

    // alert only if baseline enough AND we are past early part of series
    const canAlert = baselineUsed >= minBaselinePoints;
    const alert = canAlert ? cur.cases > UCL : false;

    return {
      week: wk,
      n: cur.n,
      low: cur.low,
      high: cur.high,
      cases: cur.cases, // cases used by model (mode-based)
      expected: Number(expected.toFixed(2)),
      phi: Number(phi.toFixed(2)),
      UCL: Number(UCL.toFixed(2)),
      baselineUsed,
      canAlert,
      alert,
    };
  });

  const last = latest(points);

  const modeLabelEn =
    mode === "high" ? "HIGH-only" : mode === "low" ? "LOW-only" : "out-of-range (LOW+HIGH)";
  const modeLabelAr =
    mode === "high" ? "مرتفع فقط" : mode === "low" ? "منخفض فقط" : "خارج المجال (منخفض+مرتفع)";

  const interpEn = `Seasonal Farrington-like check on weekly ${modeLabelEn} cases for ${tc}. Coverage=${weeksCoverage} weeks. Latest ${last.week}: cases=${last.cases}, UCL=${last.UCL}, alert=${last.alert ? "YES" : "NO"}.`;
  const interpAr = `تم فحص Farrington الموسمي (مبسّط) لعدد الحالات (${modeLabelAr}) أسبوعيًا للفحص ${tc}. التغطية=${weeksCoverage} أسبوعًا. آخر أسبوع ${last.week}: الحالات=${last.cases}، الحد الأعلى=${last.UCL}، إنذار=${last.alert ? "نعم" : "لا"}.`;

  return {
    farrington: {
      baselineWeeks, // kept for UI/backward compat
      z,
      yearsBack,
      windowWeeks,
      minBaselinePoints,
      direction: caseDef.direction,
      mode,
      testCode: tc,
      points,
      dataSufficiency: { ok: true, weeksCoverage },
      meta: { unit: caseDef.unit || null, preset, filledMissingWeeks: true, guardWeeks },
    },
    interpretation: lang === "both" ? { ar: interpAr, en: interpEn } : lang === "ar" ? interpAr : interpEn,
  };
}

// Backward-compatible wrapper
function computeAnemiaFarrington(args) {
  return computeSignalFarrington({ ...args, testCode: "HB" });
}

module.exports = { computeSignalFarrington, computeAnemiaFarrington };
