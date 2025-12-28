// apps/pulse-api/src/repositories/upload.repository.js
// Repository layer: DB access only (NO business logic)

const Upload = require("../models/Upload");

/* =========================
   Find
   ========================= */

const findBySha256 = (sha256) => Upload.findOne({ sha256 }).lean();

const findById = (uploadId) => Upload.findById(uploadId).lean();

/* =========================
   Create / Update
   ========================= */

const createUpload = (payload) => Upload.create(payload);

/**
 * Update upload metadata (status, counters, facilityIds, completedAt, etc.)
 * Note: updateOne is safe for partial updates.
 */
const updateUploadMetadata = (uploadId, payload) =>
  Upload.updateOne({ _id: uploadId }, { $set: payload });

/* =========================
   Lists / Counts
   ========================= */

const countUploads = () => Upload.countDocuments();

const listRecentUploads = (limit = 50) =>
  Upload.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select({
      originalFileName: 1,
      fileName: 1,
      sizeBytes: 1,
      rowsParsed: 1,
      rowsAccepted: 1,
      rowsRejected: 1,
      facilityIds: 1,
      regionIds: 1,
      labIds: 1,
      createdAt: 1,
      completedAt: 1,
      status: 1,
      sha256: 1,
    })
    .lean();

module.exports = {
  findBySha256,
  findById,
  createUpload,
  updateUploadMetadata,
  countUploads,
  listRecentUploads,
};
