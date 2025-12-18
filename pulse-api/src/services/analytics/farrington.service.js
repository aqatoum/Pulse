const { generateInterpretation } = require("./interpretation.service");
const ANALYTICS_DEFAULTS = require("../../config/analytics.defaults");

// ===== Helpers =====

function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const y = d.getUTCFullYear();
  const w = String(weekNo).padStart(2, "0");
  return `${y}-W${w}`;
}

// UCL ≈ mean + z * sqrt(mean)
function poissonUCL(mean, z = 2.0) {
  if (mean <= 0) return 0;
  return mean + z * Math.sqrt(mean);
}

function anemiaThresholdHb(ageYears, sex) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  const s = String(sex || "U").toUpperCase();

  let threshold = 11.0;
  if (age !== null && age >= 5 && age <= 14) threshold = 11.5;
  if (age !== null && age >= 15 && s === "F") threshold = 12.0;
  if (age !== null && age >= 15 && s === "M") threshold = 13.0;

  return threshold;
}

function getFarringtonDefaults() {
  const d = ANALYTICS_DEFAULTS?.anemia?.farrington || {};
  return {
    baselineWeeks: d?.baselineWeeks ?? 8,
    z: d?.z ?? 2.0,
  };
}

/**
 * Farrington-like outbreak detection (simplified & explainable)
 *
 * - Aggregate weekly LOW counts
 * - Build baseline from previous weeks
 * - Flag if observed > UCL
 */
function computeAnemiaFarrington({
  rows,
  baselineWeeks: baselineWeeks_in,
  z: z_in,
  lang = "both",
} = {}) {
  const defaults = getFarringtonDefaults();

  const baselineWeeks = Number.isFinite(Number(baselineWeeks_in))
    ? Math.max(1, Number(baselineWeeks_in))
    : defaults.baselineWeeks;

  const z = Number.isFinite(Number(z_in)) ? Number(z_in) : defaults.z;

  const buckets = new Map();

  for (const r of rows || []) {
    if (!r.testDate || typeof r.hb !== "number" || !Number.isFinite(r.hb)) continue;

    const wk = weekKey(new Date(r.testDate));
    if (!buckets.has(wk)) buckets.set(wk, { week: wk, low: 0, n: 0 });

    const b = buckets.get(wk);
    b.n++;

    const thr = anemiaThresholdHb(r.ageYears, r.sex);
    if (r.hb < thr) b.low++;
  }

  const series = Array.from(buckets.values()).sort((a, b) => (a.week > b.week ? 1 : -1));

  if (series.length === 0) {
    return { farrington: { points: [] }, interpretation: null };
  }

  const points = [];

  for (let i = 0; i < series.length; i++) {
    const current = series[i];

    const baselineSlice = series
      .slice(Math.max(0, i - baselineWeeks), i)
      .map((w) => w.low);

    const mean = baselineSlice.length > 0 ? baselineSlice.reduce((a, b) => a + b, 0) / baselineSlice.length : 0;
    const UCL = poissonUCL(mean, z);

    points.push({
      week: current.week,
      low: current.low,
      expected: Number(mean.toFixed(2)),
      UCL: Number(UCL.toFixed(2)),
      alert: current.low > UCL,
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
            lastZ: last.low,
            UCL: last.UCL,
            points,
            recentN: last.low,
          }),
          en: generateInterpretation({
            language: "en",
            signalType: "anemia",
            method: "FARRINGTON",
            lastZ: last.low,
            UCL: last.UCL,
            points,
            recentN: last.low,
          }),
        }
      : generateInterpretation({
          language: String(lang || "en").toLowerCase(),
          signalType: "anemia",
          method: "FARRINGTON",
          lastZ: last.low,
          UCL: last.UCL,
          points,
          recentN: last.low,
        });

  return {
    farrington: { baselineWeeks, z, points },
    interpretation,
  };
}

module.exports = { computeAnemiaFarrington };
