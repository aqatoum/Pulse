// src/pages/surveillance/charts.adapters.js

import { toNum } from "./utils.js";

/**
 * These adapters accept (payload, t?) so the chart titles can be localized.
 * If t is not provided, they fall back to English strings.
 */

export function adaptEWMA(payload, t) {
  const ew = payload?.data?.ewma || payload?.ewma || null;
  const pts = ew?.points || [];

  const series = pts
    .map((p) => ({
      label: p.week || p.label || "",
      value: toNum(p.z) ?? toNum(p.lowRate) ?? toNum(p.value),
      alert: !!p.alert,
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(ew?.UCL);

  const title = t?.chartEwmaTitle || "EWMA trend";
  const subtitle =
    t?.chartEwmaSub ||
    "EWMA summarizes recent changes smoothly. Crossing the dashed line suggests an unusual shift.";
  const yLabel = threshold !== null ? (t?.chartEwmaY || "EWMA Z (risk score)") : (t?.chartValue || "Value");

  return { title, subtitle, yLabel, points: series, threshold };
}

export function adaptCUSUM(payload, t) {
  const cu = payload?.data?.cusum || payload?.cusum || null;
  const pts = cu?.points || cu?.series || [];

  const series = (pts || [])
    .map((p) => ({
      label: p.week || p.label || "",
      value: toNum(p.S) ?? toNum(p.s) ?? toNum(p.cusum) ?? toNum(p.value) ?? toNum(p.z),
      alert: !!(p.alert || p.isAlert),
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(cu?.h) ?? toNum(cu?.H) ?? toNum(cu?.threshold);

  const title = t?.chartCusumTitle || "CUSUM accumulation";
  const subtitle =
    t?.chartCusumSub ||
    "CUSUM accumulates small deviations. A steady climb toward the dashed line indicates persistent change.";
  const yLabel = threshold !== null ? (t?.chartCusumY || "CUSUM score") : (t?.chartValue || "Value");

  return { title, subtitle, yLabel, points: series, threshold };
}

export function adaptFarrington(payload, t) {
  const fa = payload?.data?.farrington || payload?.farrington || null;
  const pts = fa?.points || fa?.series || [];

  const series = (pts || [])
    .map((p) => ({
      label: p.week || p.label || "",
      value:
        toNum(p.z) ??
        toNum(p.score) ??
        toNum(p.value) ??
        toNum(p.obs) ??
        toNum(p.observed) ??
        toNum(p.low),
      alert: !!(p.alert || p.isAlert),
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(fa?.UCL) ?? toNum(fa?.ucl) ?? toNum(fa?.threshold);

  const title = t?.chartFarrTitle || "Farrington anomaly";
  const subtitle =
    t?.chartFarrSub ||
    "Farrington compares observed counts to an expected baseline. Above the dashed line suggests an anomaly.";
  const yLabel = threshold !== null ? (t?.chartFarrY || "Anomaly score") : (t?.chartValue || "Value");

  return { title, subtitle, yLabel, points: series, threshold };
}
