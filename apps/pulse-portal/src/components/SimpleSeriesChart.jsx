import React, { useMemo } from "react";

/**
 * SimpleSeriesChart (no external libs)
 * - Draws a line for series values
 * - Optional threshold line
 * - Marks alert points
 *
 * Expected data shape:
 *   points: [{ label: "2025-W49", value: 0.55, alert: true/false }, ...]
 *   threshold: number | null
 */
export default function SimpleSeriesChart({
  title,
  subtitle,
  points = [],
  threshold = null,
  yLabel = "",
  height = 220,
}) {
  const W = 900;
  const H = height;
  const PAD = 40;

  const safe = Array.isArray(points) ? points.filter((p) => Number.isFinite(p?.value)) : [];

  const { minY, maxY } = useMemo(() => {
    if (!safe.length) return { minY: 0, maxY: 1 };
    let mn = safe[0].value;
    let mx = safe[0].value;
    for (const p of safe) {
      mn = Math.min(mn, p.value);
      mx = Math.max(mx, p.value);
    }
    if (Number.isFinite(threshold)) {
      mn = Math.min(mn, threshold);
      mx = Math.max(mx, threshold);
    }
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    // add small padding
    const span = mx - mn;
    return { minY: mn - span * 0.08, maxY: mx + span * 0.08 };
  }, [safe, threshold]);

  function x(i) {
    if (safe.length <= 1) return PAD;
    const innerW = W - PAD * 2;
    return PAD + (innerW * i) / (safe.length - 1);
  }

  function y(v) {
    const innerH = H - PAD * 2;
    const t = (v - minY) / (maxY - minY);
    return H - PAD - innerH * t;
  }

  const pathD = useMemo(() => {
    if (safe.length < 2) return "";
    let d = `M ${x(0)} ${y(safe[0].value)}`;
    for (let i = 1; i < safe.length; i++) {
      d += ` L ${x(i)} ${y(safe[i].value)}`;
    }
    return d;
  }, [safe, minY, maxY]);

  const thresholdY = Number.isFinite(threshold) ? y(threshold) : null;

  const yTicks = useMemo(() => {
    const ticks = [];
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const v = minY + ((maxY - minY) * i) / n;
      ticks.push(v);
    }
    return ticks;
  }, [minY, maxY]);

  return (
    <div style={{ borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 950, letterSpacing: ".2px" }}>{title}</div>
          {subtitle ? <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, opacity: 0.9 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 2, background: "rgba(255,255,255,0.85)", display: "inline-block" }} />
            Series
          </span>
          {Number.isFinite(threshold) ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 12, height: 2, background: "rgba(255,255,255,0.45)", display: "inline-block" }} />
              Threshold
            </span>
          ) : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(255,255,255,0.90)", display: "inline-block" }} />
            Point
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, border: "2px solid rgba(255,255,255,0.90)", background: "transparent", display: "inline-block" }} />
            Alert point
          </span>
        </div>
      </div>

      {safe.length ? (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
          {/* Grid + Y ticks */}
          {yTicks.map((v, idx) => {
            const yy = y(v);
            return (
              <g key={idx}>
                <line x1={PAD} x2={W - PAD} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <text x={PAD - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.70)">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Y label */}
          {yLabel ? (
            <text x={12} y={PAD - 10} fontSize="12" fill="rgba(255,255,255,0.70)">
              {yLabel}
            </text>
          ) : null}

          {/* Threshold */}
          {thresholdY !== null ? (
            <line x1={PAD} x2={W - PAD} y1={thresholdY} y2={thresholdY} stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="6 6" />
          ) : null}

          {/* Series line */}
          {pathD ? <path d={pathD} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" /> : null}

          {/* Points */}
          {safe.map((p, i) => {
            const xx = x(i);
            const yy = y(p.value);
            const isAlert = !!p.alert;
            return (
              <g key={i}>
                <circle cx={xx} cy={yy} r={isAlert ? 7 : 4} fill={isAlert ? "transparent" : "rgba(255,255,255,0.90)"} stroke="rgba(255,255,255,0.90)" strokeWidth={isAlert ? 2 : 0} />
                {/* X labels (sparse) */}
                {safe.length <= 10 || i === 0 || i === safe.length - 1 || i % Math.ceil(safe.length / 6) === 0 ? (
                  <text x={xx} y={H - 12} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.70)">
                    {String(p.label || "")}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.7 }}>
          لا توجد نقاط كافية للرسم بعد.
        </div>
      )}
    </div>
  );
}
