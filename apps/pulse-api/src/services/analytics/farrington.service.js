"use strict";

const { generateInterpretation } = require("./interpretation.service");
const ANALYTICS_DEFAULTS = require("../../config/analytics.defaults");

/* =========================
   ISO Week helpers
   ========================= */
function weekKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;

  // ISO week (UTC)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  const y = d.getUTCFullYear();
  const w = String(weekNo).padStart(2, "0");
  return `${y}-W${w}`;
}

function parseWeekKey(wk) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(wk || ""));
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

function sortWeekKeyAsc(a, b) {
  // string sort works for YYYY-W## format
  return String(a.week).localeCompare(String(b.week));
}

/* =========================
   Clinical threshold (Hb)
   ========================= */
function anemiaThresholdHb(ageYears, sex) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  const s = String(sex || "U").toUpperCase();

  // Keep your current rules (can be replaced by WHO table later)
  let threshold = 11.0;
  if (age !== null && age >= 5 && age <= 14) threshold = 11.5;
  if (age !== null && age >= 15 && s === "F") threshold = 12.0;
  if (age !== null && age >= 15 && s === "M") threshold = 13.0;

  return threshold;
}

/* =========================
   Farrington bounds & defaults
   ========================= */
function getFarringtonDefaults() {
  const d = ANALYTICS_DEFAULTS?.anemia?.farrington || {};
  return {
    // fallback moving baseline
    baselineWeeks: d?.baselineWeeks ?? 8,

    // threshold multiplier
    z: d?.z ?? 2.0,

    // seasonal baseline:
    // use previous years same week ± windowWeeks
    yearsBack: d?.yearsBack ?? 2,
    windowWeeks: d?.windowWeeks ?? 2,

    // minimum baseline points before calculating (otherwise keep alert=false)
    minBaselinePoints: d?.minBaselinePoints ?? 6,

    // minimum mean to avoid degenerate UCL when mean=0
    meanFloor: d?.meanFloor ?? 0.1,

    // max phi to avoid insane thresholds when data are very noisy
    phiMax: d?.phiMax ?? 5.0,
  };
}

function toFiniteNumber(x) {
  const v = typeof x === "number" ? x : Number(x);
  return Number.isFinite(v) ? v : null;
}

function clampNum(x, min, max) {
  const v = toFiniteNumber(x);
  if (v === null) return null;
  return Math.max(min, Math.min(max, v));
}

function clampInt(x, min, max) {
  const v = parseInt(String(x), 10);
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, v));
}

/* =========================
   Stats helpers
   ========================= */
function mean(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1);
  return v;
}

// UCL with over-dispersion (quasi-poisson style):
// UCL = mu + z * sqrt(phi * mu)
function uclQuasiPoisson(mu, phi, z) {
  const m = Math.max(0, mu);
  const p = Math.max(1, phi);
  return m + z * Math.sqrt(p * m);
}

// week distance on a circular 1..53 scale (approx; good enough for windowing)
function weekDistance(a, b) {
  const da = Number(a), db = Number(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999;
  const diff = Math.abs(da - db);
  return Math.min(diff, 53 - diff);
}

/* =========================
   Build weekly series from rows
   rows expected: { hb, testDate, sex, ageYears }
   ========================= */
function buildWeeklyCounts(rows) {
  const buckets = new Map();

  for (const r of rows || []) {
    const hb = toFiniteNumber(r?.hb);
    const dt = r?.testDate ? new Date(r.testDate) : null;
    if (!dt || Number.isNaN(dt.getTime()) || hb === null) continue;

    const wk = weekKey(dt);
    if (!wk) continue;

    if (!buckets.has(wk)) buckets.set(wk, { week: wk, low: 0, n: 0 });

    const b = buckets.get(wk);
    b.n++;

    const thr = anemiaThresholdHb(r.ageYears, r.sex);
    if (hb < thr) b.low++;
  }

  return Array.from(buckets.values()).sort(sortWeekKeyAsc);
}

/* =========================
   Seasonal baseline selection
   ========================= */
function pickSeasonalBaseline(seriesByWeekKey, currentWeekKey, yearsBack, windowWeeks) {
  const cur = parseWeekKey(currentWeekKey);
  if (!cur) return [];

  const values = [];
  for (const [wk, item] of seriesByWeekKey.entries()) {
    const p = parseWeekKey(wk);
    if (!p) continue;

    const yearDiff = cur.year - p.year;
    if (yearDiff <= 0 || yearDiff > yearsBack) continue;

    // same-ish week number ± window
    const dist = weekDistance(cur.week, p.week);
    if (dist <= windowWeeks) values.push(item.low);
  }
  return values;
}

function pickMovingBaseline(series, idx, baselineWeeks) {
  const slice = series.slice(Math.max(0, idx - baselineWeeks), idx);
  return slice.map((x) => x.low);
}

/* =========================
   Main
   ========================= */
function computeAnemiaFarrington({
  rows,
  baselineWeeks: baselineWeeks_in,
  z: z_in,
  yearsBack: yearsBack_in,
  windowWeeks: windowWeeks_in,
  minBaselinePoints: minBaselinePoints_in,
  lang = "both",
} = {}) {
  const d = getFarringtonDefaults();

  const baselineWeeks = clampInt(baselineWeeks_in, 2, 52) ?? d.baselineWeeks;
  const z = clampNum(z_in, 1.0, 4.0) ?? d.z;

  const yearsBack = clampInt(yearsBack_in, 1, 10) ?? d.yearsBack;
  const windowWeeks = clampInt(windowWeeks_in, 0, 8) ?? d.windowWeeks;

  const minBaselinePoints = clampInt(minBaselinePoints_in, 3, 20) ?? d.minBaselinePoints;

  const series = buildWeeklyCounts(rows);

  if (!series.length) {
    return {
      farrington: {
        baselineWeeks,
        z,
        yearsBack,
        windowWeeks,
        minBaselinePoints,
        points: [],
      },
      interpretation: null,
    };
  }

  // index for fast lookups
  const seriesByWeekKey = new Map(series.map((x) => [x.week, x]));

  const points = [];

  for (let i = 0; i < series.length; i++) {
    const cur = series[i];

    // 1) seasonal baseline
    let base = pickSeasonalBaseline(seriesByWeekKey, cur.week, yearsBack, windowWeeks);

    // 2) fallback: moving baseline if seasonal is too small
    if (base.length < minBaselinePoints) {
      const moving = pickMovingBaseline(series, i, baselineWeeks);
      // merge (dedupe not needed; they are different weeks)
      base = base.concat(moving);
    }

    // If still not enough baseline -> compute but do NOT alert (avoid nonsense)
    const baselineUsed = base.length;

    let mu = mean(base);
    mu = Math.max(mu, d.meanFloor);

    let v = variance(base);
    // quasi-poisson overdispersion
    let phi = mu > 0 ? v / mu : 1;
    if (!Number.isFinite(phi) || phi < 1) phi = 1;
    if (phi > d.phiMax) phi = d.phiMax;

    const UCL = uclQuasiPoisson(mu, phi, z);

    const alert = baselineUsed >= minBaselinePoints ? cur.low > UCL : false;

    points.push({
      week: cur.week,
      n: cur.n,
      low: cur.low,
      expected: Number(mu.toFixed(2)),
      phi: Number(phi.toFixed(2)),
      UCL: Number(UCL.toFixed(2)),
      baselineUsed,
      alert,
    });
  }

  const last = points[points.length - 1];

  const interpretation =
    String(lang || "both").toLowerCase() === "both"
      ? {
          ar: generateInterpretation({
            language: "ar",
            signalType: "anemia",
            method: "FARRINGTON",
            lastZ: last.low, // observed
            UCL: last.UCL,
            points,
            recentN: last.n,
          }),
          en: generateInterpretation({
            language: "en",
            signalType: "anemia",
            method: "FARRINGTON",
            lastZ: last.low, // observed
            UCL: last.UCL,
            points,
            recentN: last.n,
          }),
        }
      : generateInterpretation({
          language: String(lang || "en").toLowerCase(),
          signalType: "anemia",
          method: "FARRINGTON",
          lastZ: last.low,
          UCL: last.UCL,
          points,
          recentN: last.n,
        });

  return {
    farrington: {
      baselineWeeks,
      z,
      yearsBack,
      windowWeeks,
      minBaselinePoints,
      points,
    },
    interpretation,
  };
}

module.exports = { computeAnemiaFarrington };
