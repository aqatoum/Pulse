const mongoose = require("mongoose");

const LabResultSchema = new mongoose.Schema(
  {
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", index: true },

    facilityId: { type: String, required: true, index: true },
    regionId: { type: String, default: "UNKNOWN", index: true },
    labId: { type: String, default: null, index: true },

    patientKey: { type: String, default: null, index: true }, // مستعار فقط

    testCode: { type: String, required: true, index: true }, // e.g., HB
    value: { type: Number, required: true },
    unit: { type: String, required: true },

    collectedAt: { type: Date, required: true, index: true },

    ageYears: { type: Number, required: true, index: true },
    sex: { type: String, enum: ["M", "F", "U"], default: "U", index: true },

    // for fast aggregation
    year: { type: Number, index: true },
    isoWeek: { type: Number, index: true },
    yearWeek: { type: String, index: true }, // "2025-W49"
  },
  { timestamps: true }
);

// avoid accidental duplicates (soft protection)
LabResultSchema.index(
  { facilityId: 1, labId: 1, patientKey: 1, testCode: 1, collectedAt: 1, value: 1 },
  { unique: false }
);

module.exports = mongoose.model("LabResult", LabResultSchema);
