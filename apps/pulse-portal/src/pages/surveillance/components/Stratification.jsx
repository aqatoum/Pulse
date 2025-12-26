// src/pages/surveillance/components/Stratification.jsx

import React from "react";

/* =========================
   ✅ Local helpers (robust across anemia/non-anemia)
   ========================= */
function toNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}
function normalizeRate(v) {
  const n = toNum(v);
  if (n === null) return null;
  // if backend sends 0-100 percent, normalize to 0-1
  if (n > 1 && n <= 100) return n / 100;
  // if n is 0-1, keep
  if (n >= 0 && n <= 1) return n;
  return null;
}
function fmtPct(x) {
  const r = normalizeRate(x);
  if (r === null) return "—";
  return `${Math.round(r * 100)}%`;
}

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
export function barWidth(rate) {
  const r = normalizeRate(rate);
  if (r === null) return "0%";
  const pct = Math.max(0, Math.min(100, Math.round(r * 100)));
  return `${pct}%`;
}

/* =========================
   ✅ Strat Card
   ========================= */
export function StratCard({ title, items, getKey, t }) {
  const arr = Array.isArray(items) ? items : [];
  const maxN = arr.reduce((m, it) => Math.max(m, Number(it?.n || 0)), 0) || 1;

  return (
    <div className="stratCard">
      <div className="stratTitle">
        <span>{title}</span>
        <span className="stratMeta">{arr.length ? `${arr.length}` : ""}</span>
      </div>

      {!arr.length ? (
        <div className="muted">{t.empty}</div>
      ) : (
        arr.slice(0, 12).map((it, idx) => {
          const label = getKey(it);
          const n = Number(it?.n || 0);
          const rate = pickRate(it);
          const pct = fmtPct(rate);
          const weight = Math.round((n / maxN) * 100);

          return (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div className="row">
                <div className="rowLabel">{label}</div>
                <div className="rowCount">{Number.isFinite(n) ? n : "—"}</div>
                <div className="rowPct">{pct}</div>
              </div>

              <div
                className="bar"
                title={`${t.cases}: ${pickCases(it) ?? "—"} • ${t.signalRate}: ${pct}`}
              >
                <div
                  className="fill"
                  style={{
                    width: barWidth(rate),
                    opacity: 0.75 + 0.25 * (weight / 100),
                  }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
