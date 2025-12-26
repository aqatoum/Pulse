// src/pages/surveillance/strat.utils.js

import { normalizeRate, toNum, fmtPct } from "./utils.js";

export function pickRate(obj) {
  if (!obj) return null;
  return obj.caseRate ?? obj.rate ?? obj.flaggedRate ?? obj.lowRate ?? obj.highRate ?? null;
}

export function pickCases(obj) {
  if (!obj) return null;
  return obj.caseCount ?? obj.cases ?? obj.flagged ?? obj.low ?? obj.high ?? null;
}

export function keyLabelSex(x) {
  if (x === "M") return "M";
  if (x === "F") return "F";
  if (x === "U") return "U";
  return String(x || "—");
}

export function safeLabel(x) {
  const s = String(x ?? "").trim();
  return s ? s : "—";
}

// ✅ reuse shared formatter from utils.js
export { fmtPct };

export function barWidth(rate) {
  const r = normalizeRate(rate);
  if (r === null) return "0%";
  const pct = Math.max(0, Math.min(100, Math.round(r * 100)));
  return `${pct}%`;
}

/**
 * Optional helper: safely parse "n" (count) from strat items
 * keeps UI logic clean later.
 */
export function getN(it) {
  const n = toNum(it?.n);
  return n === null ? 0 : n;
}
