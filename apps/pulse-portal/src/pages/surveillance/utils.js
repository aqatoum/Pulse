// src/pages/surveillance/utils.js

/* =========================
   ✅ Basic helpers (general)
   ========================= */
export function upper(x) {
  return String(x || "").toUpperCase();
}

export function safeText(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

export function clampNum(x, min, max) {
  const v = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function clampInt(x, min, max) {
  const v = parseInt(String(x), 10);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function toNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

/* =========================
   ✅ Rates + formatting
   ========================= */
export function normalizeRate(v) {
  const n = toNum(v);
  if (n === null) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n >= 0 && n <= 1) return n;
  return null;
}

export function fmtPct(x) {
  const r = normalizeRate(x);
  if (r === null) return "—";
  return `${Math.round(r * 100)}%`;
}

export function fmtBytes(bytes) {
  const n = toNum(bytes);
  if (n === null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* =========================
   ✅ Payload extraction
   ========================= */
export function extractDateRange(j) {
  const dr = j?.analysis?.dateRange || j?.data?.dateRange || j?.dateRange || null;
  if (!dr) return null;
  const start = dr.start ?? null;
  const end = dr.end ?? null;
  const filtered = dr.filtered ?? null;
  return { start, end, filtered };
}

export function extractReport(report, lang) {
  if (!report) return "";
  if (typeof report === "string") return report;
  if (typeof report === "object") {
    if (report[lang]) return String(report[lang] || "");
    if (report.text?.[lang]) return String(report.text?.[lang] || "");
  }
  return "";
}

/* =========================
   ✅ API helpers
   ========================= */
export async function fetchJSON(url, signal) {
  const res = await fetch(url, { method: "GET", signal });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    const msg = j?.error || j?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return j;
}

export async function postFile(url, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url, { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    const msg = j?.error || j?.message || `Upload failed (${res.status})`;
    throw new Error(msg);
  }
  return j;
}

/* =========================
   ✅ Date range normalization
   ========================= */
export function normalizeDateRange(startDate, endDate) {
  const s = (startDate || "").trim();
  const e = (endDate || "").trim();
  if (!s || !e) return { start: s, end: e, swapped: false };
  if (s <= e) return { start: s, end: e, swapped: false };
  return { start: e, end: s, swapped: true };
}
