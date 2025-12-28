const express = require("express");

// ✅ عدّل مسارات الموديلات حسب مشروعك
const Upload = require("../models/Upload");       // كان عندك upload.model وهذا غالبًا خطأ
const LabResult = require("../models/LabResult"); // لإخراج testsByCode الحقيقي

const router = express.Router();

/**
 * GET /api/uploads/report
 * Query:
 *  - start=YYYY-MM-DD
 *  - end=YYYY-MM-DD
 *  - facilityId=...
 *  - regionId=...
 *
 * NOTE:
 * - Upload عندك يستخدم facilityIds/regionIds (Arrays) وليس facilityId/regionId
 * - عدد الفحوصات الصحيح = rowsAccepted (fallback) أو totalTests إن وجد
 * - testsByCode نحسبه من LabResult حتى لا يبقى صفر
 */
router.get("/report", async (req, res) => {
  try {
    const { start, end, facilityId, regionId } = req.query;

    const q = {};

    // ✅ لأن Upload عندك غالبًا arrays: facilityIds / regionIds
    if (facilityId) q.facilityIds = String(facilityId);
    if (regionId) q.regionIds = String(regionId);

    // فلترة بالتاريخ حسب createdAt
    if (start || end) {
      q.createdAt = {};
      if (start) q.createdAt.$gte = new Date(`${start}T00:00:00.000Z`);
      if (end) q.createdAt.$lte = new Date(`${end}T23:59:59.999Z`);
    }

    // 1) قائمة الملفات (Uploads)
    // حدّ معقول حتى لا يصير report ثقيل
    const files = await Upload.find(q)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const uploadIds = files.map((f) => f._id);

    // 2) ملخص عام (بدون الاعتماد على totalTests فقط)
    // ✅ totalTests الصحيح = totalTests إن وجد، وإلا rowsAccepted
    const totals = files.reduce(
      (acc, f) => {
        acc.uploads += 1;

        const totalTests =
          Number(f.totalTests ?? f.rowsAccepted ?? 0) || 0;

        acc.totalTests += totalTests;
        acc.totalSizeBytes += Number(f.sizeBytes || 0);

        return acc;
      },
      { uploads: 0, totalTests: 0, totalSizeBytes: 0 }
    );

    // 3) testsByCode الحقيقي من LabResult (أفضل من الاعتماد على Upload.testsByCode)
    // إذا ما في uploads، نتجنب aggregate
    let testsByCodeSorted = [];
    if (uploadIds.length) {
      const byTest = await LabResult.aggregate([
        { $match: { uploadId: { $in: uploadIds } } },
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
        { $group: { _id: "$testCodeNorm", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, testCode: "$_id", count: 1 } },
      ]);

      testsByCodeSorted = byTest;
    }

    // 4) تجميع حسب المرفق (نعتمد على facilityIds array + rowsAccepted)
    const byFacility = {};
    for (const f of files) {
      const facilityIds = Array.isArray(f.facilityIds) ? f.facilityIds : [];
      const totalTests = Number(f.totalTests ?? f.rowsAccepted ?? 0) || 0;

      if (facilityIds.length === 0) {
        const key = "UNKNOWN_FACILITY";
        byFacility[key] = byFacility[key] || { facilityId: key, uploads: 0, totalTests: 0 };
        byFacility[key].uploads += 1;
        byFacility[key].totalTests += totalTests;
        continue;
      }

      for (const id of facilityIds) {
        const key = String(id);
        byFacility[key] = byFacility[key] || { facilityId: key, uploads: 0, totalTests: 0 };
        byFacility[key].uploads += 1;
        byFacility[key].totalTests += totalTests;
      }
    }

    // 5) تجميع حسب المنطقة (regionIds array + rowsAccepted)
    const byRegion = {};
    for (const f of files) {
      const regionIds = Array.isArray(f.regionIds) ? f.regionIds : [];
      const totalTests = Number(f.totalTests ?? f.rowsAccepted ?? 0) || 0;

      if (regionIds.length === 0) {
        const key = "UNKNOWN_REGION";
        byRegion[key] = byRegion[key] || { regionId: key, uploads: 0, totalTests: 0 };
        byRegion[key].uploads += 1;
        byRegion[key].totalTests += totalTests;
        continue;
      }

      for (const id of regionIds) {
        const key = String(id);
        byRegion[key] = byRegion[key] || { regionId: key, uploads: 0, totalTests: 0 };
        byRegion[key].uploads += 1;
        byRegion[key].totalTests += totalTests;
      }
    }

    // 6) response
    res.json({
      ok: true,
      filters: {
        start: start || null,
        end: end || null,
        facilityId: facilityId || null,
        regionId: regionId || null,
      },
      totals: {
        uploads: totals.uploads,
        totalTests: totals.totalTests,
        totalSizeBytes: totals.totalSizeBytes,
      },
      testsByCode: testsByCodeSorted,
      byFacility: Object.values(byFacility).sort((a, b) => b.totalTests - a.totalTests),
      byRegion: Object.values(byRegion).sort((a, b) => b.totalTests - a.totalTests),
      files: files.map((f) => ({
        id: String(f._id),
        createdAt: f.createdAt || null,

        // ✅ عندك arrays
        facilityIds: Array.isArray(f.facilityIds) ? f.facilityIds : [],
        regionIds: Array.isArray(f.regionIds) ? f.regionIds : [],

        // ✅ أسماء حقول صحيحة
        originalFileName: f.originalFileName || f.fileName || null,
        fileName: f.fileName || null,

        sizeBytes: Number(f.sizeBytes || 0),

        // ✅ الرقم الصحيح الذي كان يظهر 0
        totalTests: Number(f.totalTests ?? f.rowsAccepted ?? 0) || 0,
        rowsParsed: f.rowsParsed ?? null,
        rowsAccepted: f.rowsAccepted ?? null,
        rowsRejected: f.rowsRejected ?? null,

        dateRange: f.dateRange || { start: null, end: null },
        completedAt: f.completedAt || null,
        sha256: f.sha256 || null,
        source: f.source || null,
        schema: f.schema || null,
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
