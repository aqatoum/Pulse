const mongoose = require("mongoose");

const UploadSchema = new mongoose.Schema(
  {
    schemaVersion: { type: String, default: "v1.3" },

    // file
    originalFileName: { type: String, required: true },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "text/csv" },
    sizeBytes: { type: Number, required: true },

    // dedupe
    sha256: { type: String, required: true, index: true },

    // audit
    source: { type: String, default: "CSV" },

    // ✅ explicit arrays
    facilityIds: { type: [String], default: [] },
    regionIds: { type: [String], default: [] },
    labIds: { type: [String], default: [] },

    // -----------------------------
    // ✅ Internal counters (existing)
    // -----------------------------
    rowsParsed: { type: Number, default: 0 },
    rowsAccepted: { type: Number, default: 0 },
    rowsRejected: { type: Number, default: 0 },

    quality: { type: Object, default: {} },

    // -----------------------------
    // ✅ Report/UI counters (NEW)
    // (used by /api/uploads/report)
    // -----------------------------
    rowsTotal: { type: Number, default: 0 },
    accepted: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    ignored: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },

    // Optional scalar scope ids (if single facility/region detected)
    facilityId: { type: String, default: null },
    regionId: { type: String, default: null },

    // Date range of accepted rows
    dateRange: {
      start: { type: String, default: null }, // store ISO string for compatibility
      end: { type: String, default: null },
    },

    uploadedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UploadSchema.index({ uploadedAt: -1 });
UploadSchema.index({ createdAt: -1 });

// ✅ prevents OverwriteModelError on Cloud Run
module.exports = mongoose.models.Upload || mongoose.model("Upload", UploadSchema);
