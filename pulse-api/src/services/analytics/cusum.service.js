const { generateInterpretation } = require("./interpretation.service");
const ANALYTICS_DEFAULTS = require("../../config/analytics.defaults");

// ===== Helpers =====

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

// Week key: YYYY-WW (ISO-ish)
function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const y = d.getUTCFullYear();
  const w = String(weekNo).padStart(2, "0");
  return `${y}-W${w}`;
}

function meanStd(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return { mean: null, std: null, n: 0 };

  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const varPop = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  const std = Math.sqrt(varPop);

  return { mean: Number(m.toFixed(6)), std: Number(std.toFixed(6)), n: xs.length };
}

function getCusumDefaults() {
  const d = ANALYTICS_DEFAULTS?.anemia?.cusum || {};
  return {
    baselineN: d?.baselineN ?? 4,
    k: d?.k ?? 0.5,
    h: d?.h ?? 5.0,
  };
}

/**
 * CUSUM (one-sided upper) on standardized deviation of weekly anemia lowRate.
 *
 * s_t = (x_t - mu0) / sigma0
 * C_t = max(0, C_{t-1} + s_t - k)
 * alert if C_t > h
 */
function computeAnemiaCusum({
  rows,
  baselineN: baselineN_in,
  k: k_in,
  h: h_in,
  lang = "both",
} = {}) {
  const defaults = getCusumDefaults();

  // Use defaults if caller didn't provide values
  const baselineN = Number.isFinite(Number(baselineN_in)) ? Math.max(1, Number(baselineN_in)) : defaults.baselineN;
  const k = Number.isFinite(Number(k_in)) ? Number(k_in) : defaults.k;
  const h = Number.isFinite(Number(h_in)) ? Number(h_in) : defaults.h;

  const buckets = new Map();

  for (const r of rows || []) {
    const hb = typeof r.hb === "number" && Number.isFinite(r.hb) ? r.hb : null;
    const td = r.testDate ? new Date(r.testDate) : null;
    if (!hb || !td) continue;

    const wk = weekKey(td);
    if (!buckets.has(wk)) buckets.set(wk, { week: wk, n: 0, low: 0 });

    const b = buckets.get(wk);
    b.n++;
    if (hb < anemiaThresholdHb(r.ageYears, r.sex)) b.low++;
  }

  const series = Array.from(buckets.values())
    .sort((a, b) => (a.week > b.week ? 1 : -1))
    .map((x) => ({
      week: x.week,
      n: x.n,
      low: x.low,
      x: x.n > 0 ? x.low / x.n : null,
    }))
    .filter((p) => typeof p.x === "number");

  if (series.length === 0) {
    return { cusum: { points: [] }, interpretation: null };
  }

  const baselineSlice = series.slice(0, Math.min(baselineN, series.length)).map((p) => p.x);
  const base = meanStd(baselineSlice);

  const sigma0 = base.std !== null && base.std > 0 ? base.std : 1e-6;
  const mu0 = base.mean;

  const points = [];
  let cPrev = 0;

  for (const p of series) {
    const s = mu0 !== null ? (p.x - mu0) / sigma0 : 0;
    const c = Math.max(0, cPrev + s - k);

    points.push({
      week: p.week,
      n: p.n,
      low: p.low,
      lowRate: Number(p.x.toFixed(4)),
      s: Number(s.toFixed(6)),
      c: Number(c.toFixed(6)),
      alert: c > h,
    });

    cPrev = c;
  }

  const last = points[points.length - 1];

  const interpretation =
    String(lang || "both").toLowerCase() === "both"
      ? {
          ar: generateInterpretation({
            language: "ar",
            signalType: "anemia",
            method: "CUSUM",
            lastZ: last.c,
            UCL: h,
            points,
            recentN: last.n,
          }),
          en: generateInterpretation({
            language: "en",
            signalType: "anemia",
            method: "CUSUM",
            lastZ: last.c,
            UCL: h,
            points,
            recentN: last.n,
          }),
        }
      : generateInterpretation({
          language: String(lang || "en").toLowerCase(),
          signalType: "anemia",
          method: "CUSUM",
          lastZ: last.c,
          UCL: h,
          points,
          recentN: last.n,
        });

  return {
    cusum: {
      baselineWeeksUsed: Math.min(baselineN, series.length),
      baselineMean: mu0 !== null ? Number(mu0.toFixed(6)) : null,
      baselineStd: base.std !== null ? Number(base.std.toFixed(6)) : null,
      k: Number(k),
      h: Number(h),
      points,
    },
    interpretation,
  };
}

module.exports = { computeAnemiaCusum };
