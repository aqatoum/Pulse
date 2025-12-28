const mongoose = require("mongoose");

const WeeklyAggregateSchema = new mongoose.Schema(
  {
    yearWeek: { type: String, required: true, index: true }, // "2025-W49"
    year: { type: Number, index: true },
    isoWeek: { type: Number, index: true },

    regionId: { type: String, default: "UNKNOWN", index: true },
    facilityId: { type: String, default: null, index: true },
    labId: { type: String, default: null, index: true },

    testCode: { type: String, required: true, index: true }, // HB

    sex: { type: String, enum: ["M", "F", "U"], default: "U", index: true },
    ageBand: { type: String, default: "ALL", index: true },

    n: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
    lowRate: { type: Number, default: 0 },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WeeklyAggregateSchema.index(
  { yearWeek: 1, regionId: 1, facilityId: 1, labId: 1, testCode: 1, sex: 1, ageBand: 1 },
  { unique: true }
);

module.exports = mongoose.model("WeeklyAggregate", WeeklyAggregateSchema);
