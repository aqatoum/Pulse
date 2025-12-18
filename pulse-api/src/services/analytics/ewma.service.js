const { generateInterpretation } = require("./interpretation.service");

// ===== Helpers =====

function anemiaThresholdHb(ageYears, sex) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  const s = String(sex || "U").toUpperCase();

  // WHO-ish simplified thresholds
  if (age !== null && age >= 5 && age <= 14) return 11.5;

  if (age !== null && age >= 15) {
    if (s === "F") return 12.0;
    if (s === "M") return 13.0;
    return 11.5;
  }

  return 11.0;
}

// ISO-ish week key (same logic across services)
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

// ===== Main Service =====
// rows: Array with fields: { hb, testDate, sex, ageYears }
function computeAnemiaEwma({ rows, lambda = 0.3, L = 3, baselineN = 4, lang = "both" }) {
  const buckets = new Map();

  for (const r of rows || []) {
    const hb = typeof r.hb === "number" && Number.isFinite(r.hb) ? r.hb : null;
    const td = r.testDate ? new Date(r.testDate) : null;
    if (hb === null || !td || Number.isNaN(td.getTime())) continue;

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
    .filter((p) => typeof p.x === "number" && Number.isFinite(p.x));

  if (series.length === 0) {
    return { ewma: { points: [] }, interpretation: null };
  }

  const baselineUsed = Math.min(Math.max(1, baselineN), series.length);
  const baselineSlice = series.slice(0, baselineUsed).map((p) => p.x);
  const base = meanStd(baselineSlice);

  // EWMA control limits (simple explainable form)
  const sigmaZ = (base.std ?? 0) * Math.sqrt(lambda / (2 - lambda));
  const UCL = base.mean !== null ? base.mean + L * sigmaZ : null;

  const points = [];
  let zPrev = base.mean !== null ? base.mean : series[0].x;

  for (const p of series) {
    const z = lambda * p.x + (1 - lambda) * zPrev;

    points.push({
      week: p.week,
      n: p.n,
      low: p.low,
      lowRate: Number(p.x.toFixed(4)),
      z: Number(z.toFixed(6)),
      alert: UCL !== null ? z > UCL : false,
    });

    zPrev = z;
  }

  const last = points[points.length - 1];

  const interpretation =
    String(lang || "both").toLowerCase() === "both"
      ? {
          ar: generateInterpretation({
            language: "ar",
            signalType: "anemia",
            method: "EWMA",
            lastZ: last.z,
            UCL,
            points,
            recentN: last.n,
          }),
          en: generateInterpretation({
            language: "en",
            signalType: "anemia",
            method: "EWMA",
            lastZ: last.z,
            UCL,
            points,
            recentN: last.n,
          }),
        }
      : generateInterpretation({
          language: String(lang || "en").toLowerCase(),
          signalType: "anemia",
          method: "EWMA",
          lastZ: last.z,
          UCL,
          points,
          recentN: last.n,
        });

  return {
    ewma: {
      lambda,
      L,
      baselineWeeksUsed: baselineUsed,
      baselineMean: base.mean,
      baselineStd: base.std,
      sigmaZ: Number(sigmaZ.toFixed(6)),
      UCL: UCL !== null ? Number(UCL.toFixed(6)) : null,
      points,
    },
    interpretation,
  };
}

module.exports = { computeAnemiaEwma };
