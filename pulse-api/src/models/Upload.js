const mongoose = require("mongoose");

const UploadSchema = new mongoose.Schema(
  {
    schemaVersion: { type: String, default: "v1.1" },

    originalFileName: { type: String, required: true },
    mimeType: { type: String, default: "text/csv" },
    sizeBytes: { type: Number, required: true },

    sha256: { type: String, required: true, index: true },

    // useful metadata for audit + dashboards
    facilityIds: [{ type: String }],
    regionIds: [{ type: String }],
    labIds: [{ type: String }],

    rowsParsed: { type: Number, default: 0 },
    accepted: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },

    quality: { type: Object, default: {} },

    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UploadSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model("Upload", UploadSchema);
