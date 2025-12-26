const express = require("express");
const LabResult = require("../models/LabResult");
const Upload = require("../models/Upload");
const { apiOk, apiError } = require("../utils/response");

const router = express.Router();

router.get("/report", async (req, res) => {
  try {
    // Totals
    const [files, tests, facilities, regions] = await Promise.all([
      Upload.countDocuments({}),
      LabResult.countDocuments({}),
      LabResult.distinct("facilityId").then((x) => x.filter(Boolean).length),
      LabResult.distinct("regionId").then((x) => x.filter(Boolean).length),
    ]);

    // ✅ By test (normalized + synonyms mapping)
const byTest = await LabResult.aggregate([
  {
    $project: {
      testCodeRaw: {
        $toUpper: { $trim: { input: { $ifNull: ["$testCode", ""] } } },
      },
    },
  },
  { $match: { testCodeRaw: { $ne: "" } } },

  // ✅ Map common synonyms to canonical codes
  {
    $addFields: {
      testCodeNorm: {
        $switch: {
          branches: [
            // Platelets
            { case: { $in: ["$testCodeRaw", ["PLATELETS", "PLATELET", "PLTS", "PLT#", "PLT (10^3/UL)"]] }, then: "PLT" },

            // Hemoglobin examples (optional)
            { case: { $in: ["$testCodeRaw", ["HGB", "HEMOGLOBIN"]] }, then: "HB" },
          ],
          default: "$testCodeRaw",
        },
      },
    },
  },

  { $group: { _id: "$testCodeNorm", n: { $sum: 1 } } },
  { $project: { _id: 0, testCode: "$_id", n: 1 } },
  { $sort: { n: -1, testCode: 1 } },
]);

    // Facilities
    const facilitiesAgg = await LabResult.aggregate([
      {
        $group: {
          _id: "$facilityId",
          n: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          facilityId: "$_id",
          facilityName: null,
          n: 1,
        },
      },
      { $sort: { n: -1, facilityId: 1 } },
    ]);

    // Regions
    const regionsAgg = await LabResult.aggregate([
      {
        $group: {
          _id: "$regionId",
          n: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          regionId: "$_id",
          regionName: null,
          n: 1,
        },
      },
      { $sort: { n: -1, regionId: 1 } },
    ]);

    return res.json(
      apiOk({
        totals: { files, tests, facilities, regions },
        byTest,
        facilities: facilitiesAgg,
        regions: regionsAgg,
      })
    );
  } catch (err) {
    console.error("uploads report error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

module.exports = router;
