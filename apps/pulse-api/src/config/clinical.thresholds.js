// apps/pulse-api/src/config/clinical.thresholds.js

const DAYS = (n) => n;
const WEEKS = (n) => n * 7;
const MONTHS = (n) => Math.round(n * 30.4375);
const YEARS = (n) => Math.round(n * 365.25);

/**
 * Bands use age in DAYS for pediatrics precision.
 * direction: "high" | "low" | "both"
 *
 * Each test:
 * - unit: normalized unit string
 * - direction: default direction (can be both for CBC)
 * - bands: [{minDays,maxDays,lower,upper}]
 * - sexBands: optional {M:[bands], F:[bands]}
 * - aliases: optional alternative codes
 * - aliasOf: optional alias mapping to another test key
 */
module.exports = {
  // ===== CBC =====
  WBC: {
    label: "White Blood Cells",
    unit: "x10^9/L",
    direction: "both",
    aliases: ["LEUK", "LEUCOCYTES"],
    bands: [
      { minDays: DAYS(0), maxDays: DAYS(1), lower: 9.0, upper: 30.0 },
      { minDays: DAYS(1) + 1, maxDays: WEEKS(1), lower: 5.0, upper: 21.0 },
      { minDays: WEEKS(1) + 1, maxDays: MONTHS(1), lower: 5.0, upper: 19.5 },
      { minDays: MONTHS(1) + 1, maxDays: YEARS(1), lower: 6.0, upper: 17.5 },
      { minDays: YEARS(1) + 1, maxDays: YEARS(2), lower: 5.0, upper: 15.5 },
      { minDays: YEARS(2) + 1, maxDays: YEARS(4), lower: 6.0, upper: 15.5 },
      { minDays: YEARS(4) + 1, maxDays: YEARS(6), lower: 5.0, upper: 13.5 },
      { minDays: YEARS(6) + 1, maxDays: YEARS(10), lower: 4.5, upper: 13.5 },
      { minDays: YEARS(10) + 1, maxDays: YEARS(14), lower: 5.0, upper: 11.0 },
      { minDays: YEARS(14) + 1, maxDays: YEARS(200), lower: 4.5, upper: 11.0 },
    ],
  },

  PLT: {
    label: "Platelets",
    unit: "x10^9/L",
    direction: "both",
    aliases: ["PLATELETS", "PLTS"],
    bands: [
      { minDays: DAYS(0), maxDays: DAYS(3), lower: 250, upper: 450 },
      { minDays: DAYS(3) + 1, maxDays: DAYS(9), lower: 200, upper: 400 },
      { minDays: DAYS(9) + 1, maxDays: MONTHS(1), lower: 170, upper: 600 },
      { minDays: MONTHS(1) + 1, maxDays: MONTHS(6), lower: 190, upper: 660 },
      { minDays: MONTHS(6) + 1, maxDays: YEARS(2), lower: 190, upper: 610 },
      { minDays: YEARS(2) + 1, maxDays: YEARS(8), lower: 160, upper: 500 },
      { minDays: YEARS(8) + 1, maxDays: YEARS(12), lower: 155, upper: 430 },
      { minDays: YEARS(12) + 1, maxDays: YEARS(200), lower: 140, upper: 400 },
    ],
  },

  HB: {
    label: "Hemoglobin",
    unit: "g/dL",
    direction: "both",
    aliases: ["HGB"],
    bands: [
      { minDays: DAYS(0), maxDays: DAYS(3), lower: 14.5, upper: 22.5 },
      { minDays: DAYS(3) + 1, maxDays: WEEKS(1), lower: 13.5, upper: 21.5 },
      { minDays: WEEKS(1) + 1, maxDays: WEEKS(2), lower: 12.5, upper: 20.5 },
      { minDays: WEEKS(2) + 1, maxDays: MONTHS(1), lower: 10.0, upper: 18.0 },
      { minDays: MONTHS(1) + 1, maxDays: MONTHS(2), lower: 9.0, upper: 14.0 },
      { minDays: MONTHS(2) + 1, maxDays: MONTHS(6), lower: 9.5, upper: 13.5 },
      { minDays: MONTHS(6) + 1, maxDays: YEARS(2), lower: 10.5, upper: 13.5 },
      { minDays: YEARS(2) + 1, maxDays: YEARS(6), lower: 11.5, upper: 13.5 },
      { minDays: YEARS(6) + 1, maxDays: YEARS(12), lower: 11.5, upper: 15.5 },
    ],
    sexBands: {
      F: [{ minDays: YEARS(12), maxDays: YEARS(200), lower: 12.0, upper: 16.0 }],
      M: [
        { minDays: YEARS(12), maxDays: YEARS(18), lower: 13.0, upper: 16.0 },
        { minDays: YEARS(18), maxDays: YEARS(200), lower: 13.5, upper: 17.5 },
      ],
    },
  },

  // aliases by aliasOf (optional style)
  HGB: { aliasOf: "HB" },

  // ===== Inflammation example =====
  CRP: {
    label: "C-Reactive Protein",
    unit: "mg/L",
    direction: "high",
    bands: [{ minDays: DAYS(0), maxDays: YEARS(200), upper: 5.0 }],
  },
};
