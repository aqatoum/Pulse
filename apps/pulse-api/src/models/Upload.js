const mongoose = require("mongoose");

const UploadSchema = new mongoose.Schema(
  {
    schemaVersion: { type: String, default: "v1.2" },

    // file
    originalFileName: { type: String, required: true },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "text/csv" },
    sizeBytes: { type: Number, required: true },

    // dedupe
    sha256: { type: String, required: true, index: true },

    // audit
    source: { type: String, default: "CSV" },

    // ✅ IMPORTANT: arrays must be explicit + default []
    facilityIds: { type: [String], default: [] },
    regionIds: { type: [String], default: [] },
    labIds: { type: [String], default: [] },

    rowsParsed: { type: Number, default: 0 },

    // ✅ match your route naming
    rowsAccepted: { type: Number, default: 0 },
    rowsRejected: { type: Number, default: 0 },

    quality: { type: Object, default: {} },

    uploadedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UploadSchema.index({ uploadedAt: -1 });

// ✅ prevents OverwriteModelError on Cloud Run
module.exports = mongoose.models.Upload || mongoose.model("Upload", UploadSchema);
