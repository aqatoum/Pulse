// src/config/clinical.thresholds.js
module.exports = {
  // Units assumed:
  // WBC: x10^9/L  (same as K/uL numerically)
  // PLT: x10^9/L  (same as K/uL numerically)
  // CRP: mg/L

  WBC: {
    unit: "x10^9/L",
    direction: "high",
    bands: [
      { min: 0, max: 4, upper: 17.5 },   // broadly aligns with young children ranges :contentReference[oaicite:4]{index=4}
      { min: 5, max: 14, upper: 14.5 },  // 6–9 upper 14.5, 10–17 upper 13.5 :contentReference[oaicite:5]{index=5}
      { min: 15, max: 64, upper: 11.0 }, // adult upper ~11 :contentReference[oaicite:6]{index=6}
      { min: 65, max: 200, upper: 11.0 },
    ],
  },

  PLT: {
    unit: "x10^9/L",
    direction: "low",
    bands: [
      { min: 0, max: 4, lower: 170 },    // conservative for infants/toddlers :contentReference[oaicite:7]{index=7}
      { min: 5, max: 14, lower: 155 },   // 8–12 lower 155 :contentReference[oaicite:8]{index=8}
      { min: 15, max: 200, lower: 140 }, // 12+ adult lower 140 :contentReference[oaicite:9]{index=9}
    ],
  },

  CRP: {
    unit: "mg/L",
    direction: "high",
    bands: [
      { min: 0, max: 200, upper: 10 },   // common clinical cutpoint 8–10 mg/L :contentReference[oaicite:10]{index=10}
    ],
  },
};
