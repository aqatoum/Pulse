// src/pages/surveillance/components/StratCard.jsx
import React from "react";
import {
  pickRate,
  pickCases,
  keyLabelSex,
  safeLabel,
  barWidth,
  getN,
  fmtPct,
} from "../strat.utils.js";

export default function StratCard({ title, items, getKey, t }) {
  const arr = Array.isArray(items) ? items : [];
  const maxN = arr.reduce((m, it) => Math.max(m, getN(it)), 0) || 1;

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
          const n = getN(it);
          const rate = pickRate(it);
          const pct = fmtPct(rate);
          const weight = Math.round((n / maxN) * 100);

          return (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div className="row">
                <div className="rowLabel">{label}</div>
                <div className="rowCount">{n}</div>
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
