const mongoose = require("mongoose");

const WeeklyAggregateSchema = new mongoose.Schema(
  {
    // =====================
    // Time (ISO week)
    // =====================
    yearWeek: { type: String, required: true, index: true }, // e.g. "2025-W49"
    year: { type: Number, index: true },
    isoWeek: { type: Number, index: true },

    // =====================
    // Location
    // =====================
    regionId: { type: String, default: "UNKNOWN", index: true },
    facilityId: { type: String, default: null, index: true },
    labId: { type: String, default: null, index: true },

    // =====================
    // Test & stratification
    // =====================
    testCode: { type: String, required: true, index: true }, // HB, WBC, CRP, ...
    sex: { type: String, enum: ["M", "F", "U"], default: "U", index: true },
    ageBand: { type: String, default: "ALL", index: true },

    // =====================
    // General aggregates (NEW)
    // =====================
    n: { type: Number, default: 0 },          // count
    sum: { type: Number, default: 0 },        // Σx
    sumSq: { type: Number, default: 0 },      // Σx²
    min: { type: Number, default: null },     // min(x)
    max: { type: Number, default: null },     // max(x)

    // =====================
    // Legacy anemia fields (KEEP for compatibility)
    // =====================
    low: { type: Number, default: 0 },         // legacy: low HB count
    lowRate: { type: Number, default: 0 },     // legacy: low / n

    // =====================
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// =====================
// Uniqueness per stratum
// =====================
WeeklyAggregateSchema.index(
  {
    yearWeek: 1,
    regionId: 1,
    facilityId: 1,
    labId: 1,
    testCode: 1,
    sex: 1,
    ageBand: 1,
  },
  { unique: true }
);

module.exports = mongoose.model("WeeklyAggregate", WeeklyAggregateSchema);
