// apps/pulse-api/src/repositories/labResult.repository.js
// Repository layer: DB access only (NO business logic)

const LabResult = require("../models/LabResult");

/* =========================
   Insert operations
   ========================= */

/**
 * Insert many lab results (used during CSV upload).
 * ordered:false => continue inserting even if some docs fail.
 */
const insertManyResults = (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return Promise.resolve({ insertedCount: 0 });
  }
  return LabResult.insertMany(docs, { ordered: false });
};

/* =========================
   Basic counts & distincts
   ========================= */

const countLabResults = () => LabResult.countDocuments();

const countByUploadId = (uploadId) =>
  LabResult.countDocuments({ uploadId });

const distinctFacilityIds = () =>
  LabResult.distinct("facilityId", { facilityId: { $ne: null } });

const distinctRegionIds = () =>
  LabResult.distinct("regionId", { regionId: { $ne: null } });

/* =========================
   Query by upload (traceability)
   ========================= */

const findByUploadId = (uploadId, { limit = 5000 } = {}) =>
  LabResult.find({ uploadId })
    .sort({ collectedAt: 1 })
    .limit(limit)
    .lean();

/* =========================
   Aggregations (analytics support)
   ========================= */

const aggregateByTest = () =>
  LabResult.aggregate([
    {
      $project: {
        testCodeNorm: {
          $cond: [
            {
              $or: [
                { $eq: ["$testCode", null] },
                { $eq: ["$testCode", ""] },
              ],
            },
            "UNKNOWN",
            { $toUpper: "$testCode" },
          ],
        },
      },
    },
    { $group: { _id: "$testCodeNorm", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $project: { _id: 0, testCode: "$_id", n: 1 } },
  ]);

const aggregateFacilities = () =>
  LabResult.aggregate([
    { $match: { facilityId: { $ne: null } } },
    {
      $group: {
        _id: "$facilityId",
        facilityName: { $last: "$facilityName" },
        n: { $sum: 1 },
      },
    },
    { $sort: { n: -1 } },
    { $project: { _id: 0, facilityId: "$_id", facilityName: 1, n: 1 } },
    { $limit: 500 },
  ]);

const aggregateRegions = () =>
  LabResult.aggregate([
    { $match: { regionId: { $ne: null } } },
    {
      $group: {
        _id: "$regionId",
        regionName: { $last: "$regionName" },
        n: { $sum: 1 },
      },
    },
    { $sort: { n: -1 } },
    { $project: { _id: 0, regionId: "$_id", regionName: 1, n: 1 } },
    { $limit: 500 },
  ]);

/* =========================
   Exports
   ========================= */

module.exports = {
  // insert
  insertManyResults,

  // counts
  countLabResults,
  countByUploadId,

  // queries
  findByUploadId,

  // distincts
  distinctFacilityIds,
  distinctRegionIds,

  // aggregations
  aggregateByTest,
  aggregateFacilities,
  aggregateRegions,
};
