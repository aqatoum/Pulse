import React from "react";

export default function DecisionCard({ title, value = "INFO", hint }) {
  const tone =
    value === "ALERT" ? "toneAlert" : value === "WATCH" ? "toneWatch" : "toneInfo";

  return (
    <div className={`card ${tone}`}>
      <div className="cardHeader">
        <div className="cardTitle">{title}</div>
        <span className="pill">{value}</span>
      </div>
      {hint ? <div className="cardHint">{hint}</div> : null}
    </div>
  );
}
