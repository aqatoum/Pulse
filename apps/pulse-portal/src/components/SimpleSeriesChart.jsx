// src/components/SimpleSeriesChart.jsx
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

function toNum(x) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function defaultTickFormatter(v) {
  if (v === null || v === undefined) return "";
  const n = toNum(v);
  if (n === null) return String(v);
  // رقمين كحد أقصى
  return Math.abs(n) >= 100 ? String(Math.round(n)) : n.toFixed(2);
}

export default function SimpleSeriesChart({
  title,
  subtitle,
  yLabel,
  points = [],
  threshold = null,
}) {
  const data = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    return arr.map((p, idx) => ({
      idx,
      label: p?.label ?? "",
      value: toNum(p?.value),
      alert: !!p?.alert,
    }));
  }, [points]);

  const hasData = data.some((d) => Number.isFinite(d.value));

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        border: "1px solid rgba(15,23,42,.10)",
        background: "rgba(255,255,255,.92)",
        boxShadow: "0 18px 50px rgba(15,23,42,.10)",
      }}
    >
      {/* Header */}
      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "rgba(15,23,42,.95)" }}>
          {title || "Series"}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: "rgba(15,23,42,.60)", lineHeight: 1.6 }}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* Chart area: ثابت الارتفاع حتى ما “يكسّر” الصفحة */}
      <div
        style={{
          height: 260,
          width: "100%",
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(249,250,251,1), rgba(239,246,255,.55))",
          border: "1px solid rgba(15,23,42,.08)",
          overflow: "hidden",
        }}
      >
        {!hasData ? (
          <div style={{ padding: 14, fontSize: 12, color: "rgba(15,23,42,.55)" }}>
            No chart data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 18, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={defaultTickFormatter}
                width={52}
                label={
                  yLabel
                    ? {
                        value: yLabel,
                        angle: -90,
                        position: "insideLeft",
                        offset: 8,
                        style: { fill: "rgba(15,23,42,.65)", fontSize: 11, fontWeight: 600 },
                      }
                    : undefined
                }
              />
              <Tooltip />
              <Legend verticalAlign="top" height={22} />

              {threshold !== null && Number.isFinite(Number(threshold)) ? (
                <ReferenceLine
                  y={Number(threshold)}
                  strokeDasharray="6 6"
                  stroke="rgba(37,99,235,.70)"
                  ifOverflow="extendDomain"
                />
              ) : null}

              <Line
                type="monotone"
                dataKey="value"
                stroke="rgba(37,99,235,.92)"
                strokeWidth={2.2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (!Number.isFinite(payload?.value)) return null;
                  const isAlert = !!payload?.alert;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isAlert ? 5 : 3}
                      fill={isAlert ? "rgba(239,68,68,.95)" : "rgba(37,99,235,.95)"}
                      stroke="white"
                      strokeWidth={1.4}
                    />
                  );
                }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
