// src/pages/surveillance/components/ParamSlider.jsx

import React from "react";

export default function ParamSlider({
  name,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  hint,
}) {
  return (
    <div className="paramRow">
      <div className="paramTop">
        <div className="paramName">{name}</div>
        <div className="paramVal">{String(value)}</div>
      </div>

      <input
        className="rangeInput"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {hint ? <div className="paramHint">{hint}</div> : null}
    </div>
  );
}
