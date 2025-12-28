// src/config/clinical.thresholds.js
// Global default clinical thresholds for POPULATION SURVEILLANCE.
// NOT for individual diagnosis.
// Reference ranges vary by lab; calibrate locally when possible.

module.exports = {
  /**
   * HB / HGB — Anemia (WHO-aligned)
   * Direction: LOW
   *
   * WHO thresholds (simplified):
   * - Children 6–59 months: <11.0 g/dL
   * - Children 5–11 years: <11.5 g/dL
   * - Adolescents 12–14 years: <12.0 g/dL
   * - Adult women: <12.0 g/dL
   * - Adult men: <13.0 g/dL
   */
  HB: {
    unit: "g/dL",
    direction: "low",
    mode: "ageSex", // tells analytics to use age+sex logic
    thresholds: {
      child_under_5: 11.0,
      child_5_11: 11.5,
      adolescent_12_14: 12.0,
      adult_female: 12.0,
      adult_male: 13.0,
    },
  },

  /**
   * WBC — Leukocytosis
   * Direction: HIGH
   */
  WBC: {
    unit: "x10^9/L",
    direction: "high",
    bands: [
      { min: 0, max: 0.08, upper: 30.0 },
      { min: 0.09, max: 0.25, upper: 19.5 },
      { min: 0.26, max: 1.0, upper: 17.5 },
      { min: 1.01, max: 2.0, upper: 17.0 },
      { min: 2.01, max: 4.99, upper: 15.5 },
      { min: 5.0, max: 11.99, upper: 14.5 },
      { min: 12.0, max: 18.0, upper: 13.0 },
      { min: 18.01, max: 200, upper: 11.0 },
    ],
  },

  /**
   * PLT — Thrombocytopenia
   * Direction: LOW
   */
  PLT: {
    unit: "x10^9/L",
    direction: "low",
    bands: [
      { min: 0, max: 200, lower: 150 },
    ],
  },

  /**
   * CRP — Inflammation
   * Direction: HIGH
   */
  CRP: {
    unit: "mg/L",
    direction: "high",
    bands: [
      { min: 0, max: 200, upper: 10 },
    ],
  },
};
