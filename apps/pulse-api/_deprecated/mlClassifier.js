// apps/pulse-api/src/services/reports/explainReport/mlClassifier.js

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * features expected:
 * - weeksTotal
 * - weeksWithAlert (from ewma/cusum)
 * - maxZ (ewma z peak)  [optional]
 * - consecutiveAlertWeeks
 * - meanWeeklyN
 * - missingWeeks
 */
function classify(features) {
  const f = features || {};
  const weeksTotal = f.weeksTotal || 0;

  // Rule: insufficient
  if (weeksTotal < 4 || (f.meanWeeklyN || 0) <= 0) return "INSUFFICIENT";

  // Score-based "ML-like" decision
  // (weights can be tuned later with real data)
  let score = 0;

  // persistence matters most
  score += 2.5 * clamp(f.consecutiveAlertWeeks || 0, 0, 6);

  // repeated alerts matter
  score += 1.2 * clamp(f.weeksWithAlert || 0, 0, 10);

  // strength (if z exists)
  if (Number.isFinite(f.maxZ)) score += 0.8 * clamp(f.maxZ, 0, 10);

  // penalize poor data
  score -= 0.6 * clamp(f.missingWeeks || 0, 0, 10);

  // if volume tiny, reduce confidence (not status) — but we can mildly penalize
  const meanN = f.meanWeeklyN || 0;
  if (meanN < 20) score -= 1.0;
  if (meanN < 10) score -= 1.5;

  // thresholds tuned for calm behavior
  if (score >= 9) return "ALERT";
  if (score >= 3) return "ATTENTION";
  return "STABLE";
}

module.exports = { classify };
