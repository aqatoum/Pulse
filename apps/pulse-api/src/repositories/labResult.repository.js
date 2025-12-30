const LabResult = require("../models/LabResult");

const insertManyResults = (docs) => LabResult.insertMany(docs, { ordered: false });

const countLabResults = () => LabResult.countDocuments();

const distinctFacilityIds = () =>
  LabResult.distinct("facilityId", { facilityId: { $ne: null } });

const distinctRegionIds = () =>
  LabResult.distinct("regionId", { regionId: { $ne: null } });

const aggregateByTest = () =>
  LabResult.aggregate([
    {
      $project: {
        testCodeNorm: {
          $cond: [
            {
              $or: [{ $eq: ["$testCode", null] }, { $eq: ["$testCode", ""] }],
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

module.exports = {
  insertManyResults,
  countLabResults,
  distinctFacilityIds,
  distinctRegionIds,
  aggregateByTest,
  aggregateFacilities,
  aggregateRegions,
};
