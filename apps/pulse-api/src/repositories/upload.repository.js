const Upload = require("../models/Upload");

const findBySha256 = (sha256) => Upload.findOne({ sha256 }).lean();

const createUpload = (payload) => Upload.create(payload);

const updateUploadMetadata = (uploadId, payload) =>
  Upload.updateOne({ _id: uploadId }, { $set: payload });

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
    })
    .lean();

module.exports = {
  findBySha256,
  createUpload,
  updateUploadMetadata,
  countUploads,
  listRecentUploads,
};
