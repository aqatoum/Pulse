const mongoose = require("mongoose");

const LabResultSchema = new mongoose.Schema(
  {
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: "Upload", index: true },

    // ✅ scope fields are now OPTIONAL to support GLOBAL analysis
    facilityId: { type: String, trim: true, default: null, index: true },
    facilityName: { type: String, trim: true, default: null, index: true },

    regionId: { type: String, trim: true, default: null, index: true },
    regionName: { type: String, trim: true, default: null, index: true },

    labId: { type: String, trim: true, default: null, index: true },

    patientKey: { type: String, default: null, index: true }, // مستعار فقط

    // ✅ universal test support (any test)
    testCode: { type: String, required: true, trim: true, index: true }, // e.g., HB, WBC, CRP, PLT
    value: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },

    collectedAt: { type: Date, required: true, index: true },

    ageYears: { type: Number, required: true, index: true },
    sex: { type: String, enum: ["M", "F", "U"], default: "U", index: true },

    // ✅ NEW: nationality for demographic stratification
    nationality: { type: String, trim: true, default: null, index: true },

    // for fast aggregation
    year: { type: Number, index: true },
    isoWeek: { type: Number, index: true },
    yearWeek: { type: String, index: true }, // "2025-W49"
  },
  { timestamps: true }
);

// avoid accidental duplicates (soft protection)
// ✅ facilityId/regionId may be null now, so do not rely on them in the index
LabResultSchema.index(
  { labId: 1, patientKey: 1, testCode: 1, collectedAt: 1, value: 1 },
  { unique: false }
);

module.exports = mongoose.model("LabResult", LabResultSchema);
