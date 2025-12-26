const express = require("express");
const Upload = require("../models/upload.model");

const router = express.Router();

/**
 * GET /api/uploads/report
 * Query:
 *  - start=YYYY-MM-DD
 *  - end=YYYY-MM-DD
 *  - facilityId=...
 *  - regionId=...
 */
router.get("/report", async (req, res) => {
  try {
    const { start, end, facilityId, regionId } = req.query;

    const q = {};
    if (facilityId) q.facilityId = String(facilityId);
    if (regionId) q.regionId = String(regionId);

    // فلترة بالتاريخ حسب createdAt (يمكن تغييرها إلى dateRange.start لو تحب)
    if (start || end) {
      q.createdAt = {};
      if (start) q.createdAt.$gte = new Date(`${start}T00:00:00.000Z`);
      if (end) q.createdAt.$lte = new Date(`${end}T23:59:59.999Z`);
    }

    // 1) قائمة الملفات
    const files = await Upload.find(q)
      .sort({ createdAt: -1 })
      .lean();

    // 2) ملخص عام
    const totals = files.reduce(
      (acc, f) => {
        acc.uploads += 1;
        acc.totalTests += Number(f.totalTests || 0);
        acc.totalSizeBytes += Number(f.sizeBytes || 0);

        // merge testsByCode
        const map = f.testsByCode || {};
        for (const [k, v] of Object.entries(map)) {
          const key = String(k).toUpperCase();
          acc.testsByCode[key] = (acc.testsByCode[key] || 0) + Number(v || 0);
        }
        return acc;
      },
      { uploads: 0, totalTests: 0, totalSizeBytes: 0, testsByCode: {} }
    );

    // 3) تجميع حسب المرفق
    const byFacility = {};
    for (const f of files) {
      const key = f.facilityId || "UNKNOWN_FACILITY";
      byFacility[key] = byFacility[key] || { facilityId: key, uploads: 0, totalTests: 0 };
      byFacility[key].uploads += 1;
      byFacility[key].totalTests += Number(f.totalTests || 0);
    }

    // 4) تجميع حسب المنطقة
    const byRegion = {};
    for (const f of files) {
      const key = f.regionId || "UNKNOWN_REGION";
      byRegion[key] = byRegion[key] || { regionId: key, uploads: 0, totalTests: 0 };
      byRegion[key].uploads += 1;
      byRegion[key].totalTests += Number(f.totalTests || 0);
    }

    // 5) ترتيب testsByCode تنازلياً
    const testsByCodeSorted = Object.entries(totals.testsByCode)
      .map(([testCode, count]) => ({ testCode, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      ok: true,
      filters: { start: start || null, end: end || null, facilityId: facilityId || null, regionId: regionId || null },
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
        createdAt: f.createdAt,
        facilityId: f.facilityId || null,
        regionId: f.regionId || null,
        originalName: f.originalName,
        storedName: f.storedName,
        sizeBytes: f.sizeBytes || 0,
        totalTests: f.totalTests || 0,
        dateRange: f.dateRange || { start: null, end: null },
        testsByCode: f.testsByCode || {},
      })),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
