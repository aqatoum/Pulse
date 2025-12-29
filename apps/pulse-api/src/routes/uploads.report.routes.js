const express = require("express");
const Upload = require("../models/upload.model");

const router = express.Router();

function toDateStartUTC(d) {
  return new Date(`${d}T00:00:00.000Z`);
}
function toDateEndUTC(d) {
  return new Date(`${d}T23:59:59.999Z`);
}

// يقرأ القيمة حتى لو كان اسم الحقل مختلفاً بين النسخ
function pickStat(obj, keys, fallback = 0) {
  for (const k of keys) {
    const v = obj?.[k];
    if (Number.isFinite(Number(v))) return Number(v);
  }
  return fallback;
}

/**
 * GET /api/uploads/report
 * Query: start=YYYY-MM-DD&end=YYYY-MM-DD&facilityId=...&regionId=...
 */
router.get("/report", async (req, res) => {
  try {
    const { start, end, facilityId, regionId } = req.query;

    const match = {};
    if (facilityId) match.facilityId = String(facilityId);
    if (regionId) match.regionId = String(regionId);

    // فلترة تاريخ: تشتغل على createdAt إن وجد، وإلا على dateRange.start إن وجد
    if (start || end) {
      const range = {};
      if (start) range.$gte = toDateStartUTC(start);
      if (end) range.$lte = toDateEndUTC(end);

      // سنحاول createdAt أولاً، وإذا لا يوجد في بياناتك استخدم dateRange.start
      match.$or = [
        { createdAt: range },
        { "dateRange.start": range },
      ];
    }

    // نستخدم Aggregation لتجميع كل شيء في ضربة واحدة (أسرع بكثير من find+reduce)
    const [agg] = await Upload.aggregate([
      { $match: match },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          files: [
            { $limit: 200 }, // سقف منطقي لعرض الملفات (عدّله حسب حاجتك)
            {
              $project: {
                _id: 1,
                createdAt: 1,
                facilityId: 1,
                regionId: 1,
                originalName: 1,
                storedName: 1,
                sizeBytes: { $ifNull: ["$sizeBytes", 0] },
                dateRange: { $ifNull: ["$dateRange", { start: null, end: null }] },

                // ✅ احصاءات الرفع (أسماء محتملة متعددة)
                rowsTotal: {
                  $ifNull: [
                    "$rowsTotal",
                    { $ifNull: ["$totalRows", { $ifNull: ["$rowCount", 0] }] },
                  ],
                },
                accepted: {
                  $ifNull: [
                    "$accepted",
                    { $ifNull: ["$acceptedCount", { $ifNull: ["$validRows", 0] }] },
                  ],
                },
                rejected: {
                  $ifNull: [
                    "$rejected",
                    { $ifNull: ["$rejectedCount", { $ifNull: ["$invalidRows", 0] }] },
                  ],
                },
                ignored: {
                  $ifNull: [
                    "$ignored",
                    { $ifNull: ["$ignoredCount", 0] },
                  ],
                },
                errors: {
                  $ifNull: [
                    "$errors",
                    { $ifNull: ["$errorCount", 0] },
                  ],
                },
                duplicates: {
                  $ifNull: [
                    "$duplicates",
                    { $ifNull: ["$duplicateCount", 0] },
                  ],
                },

                // ✅ لو عندك تجميع حسب الفحص
                testsByCode: { $ifNull: ["$testsByCode", {}] },
                totalTests: { $ifNull: ["$totalTests", 0] },
              },
            },
          ],

          totals: [
            {
              $group: {
                _id: null,
                uploads: { $sum: 1 },
                totalSizeBytes: { $sum: { $ifNull: ["$sizeBytes", 0] } },

                // حاول تجميع “ملخص الرفع” من نفس الحقول
                rowsTotal: {
                  $sum: {
                    $ifNull: [
                      "$rowsTotal",
                      { $ifNull: ["$totalRows", { $ifNull: ["$rowCount", 0] }] },
                    ],
                  },
                },
                accepted: {
                  $sum: {
                    $ifNull: [
                      "$accepted",
                      { $ifNull: ["$acceptedCount", { $ifNull: ["$validRows", 0] }] },
                    ],
                  },
                },
                rejected: {
                  $sum: {
                    $ifNull: [
                      "$rejected",
                      { $ifNull: ["$rejectedCount", { $ifNull: ["$invalidRows", 0] }] },
                    ],
                  },
                },
                ignored: {
                  $sum: {
                    $ifNull: [
                      "$ignored",
                      { $ifNull: ["$ignoredCount", 0] },
                    ],
                  },
                },
                errors: {
                  $sum: {
                    $ifNull: [
                      "$errors",
                      { $ifNull: ["$errorCount", 0] },
                    ],
                  },
                },
                duplicates: {
                  $sum: {
                    $ifNull: [
                      "$duplicates",
                      { $ifNull: ["$duplicateCount", 0] },
                    ],
                  },
                },

                // إجمالي الفحوصات إن كان مخزنًا
                totalTests: { $sum: { $ifNull: ["$totalTests", 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                uploads: 1,
                totalSizeBytes: 1,
                rowsTotal: 1,
                accepted: 1,
                rejected: 1,
                ignored: 1,
                errors: 1,
                duplicates: 1,
                totalTests: 1,
              },
            },
          ],

          byFacility: [
            {
              $group: {
                _id: { $ifNull: ["$facilityId", "UNKNOWN_FACILITY"] },
                uploads: { $sum: 1 },
                accepted: {
                  $sum: {
                    $ifNull: [
                      "$accepted",
                      { $ifNull: ["$acceptedCount", { $ifNull: ["$validRows", 0] }] },
                    ],
                  },
                },
                rowsTotal: {
                  $sum: {
                    $ifNull: [
                      "$rowsTotal",
                      { $ifNull: ["$totalRows", { $ifNull: ["$rowCount", 0] }] },
                    ],
                  },
                },
              },
            },
            { $sort: { accepted: -1, uploads: -1 } },
            {
              $project: {
                _id: 0,
                facilityId: "$_id",
                uploads: 1,
                rowsTotal: 1,
                accepted: 1,
              },
            },
          ],

          byRegion: [
            {
              $group: {
                _id: { $ifNull: ["$regionId", "UNKNOWN_REGION"] },
                uploads: { $sum: 1 },
                accepted: {
                  $sum: {
                    $ifNull: [
                      "$accepted",
                      { $ifNull: ["$acceptedCount", { $ifNull: ["$validRows", 0] }] },
                    ],
                  },
                },
                rowsTotal: {
                  $sum: {
                    $ifNull: [
                      "$rowsTotal",
                      { $ifNull: ["$totalRows", { $ifNull: ["$rowCount", 0] }] },
                    ],
                  },
                },
              },
            },
            { $sort: { accepted: -1, uploads: -1 } },
            {
              $project: {
                _id: 0,
                regionId: "$_id",
                uploads: 1,
                rowsTotal: 1,
                accepted: 1,
              },
            },
          ],
        },
      },
    ]);

    const files = agg?.files || [];
    const totals = (agg?.totals && agg.totals[0]) || {
      uploads: 0,
      totalSizeBytes: 0,
      rowsTotal: 0,
      accepted: 0,
      rejected: 0,
      ignored: 0,
      errors: 0,
      duplicates: 0,
      totalTests: 0,
    };

    // ✅ تجميع testsByCode عبر الملفات (لأن Mongo أصعب في دمج object keys)
    const testsByCodeMap = {};
    for (const f of files) {
      const map = f.testsByCode || {};
      for (const [k, v] of Object.entries(map)) {
        const key = String(k).toUpperCase();
        testsByCodeMap[key] = (testsByCodeMap[key] || 0) + Number(v || 0);
      }
    }
    const testsByCode = Object.entries(testsByCodeMap)
      .map(([testCode, count]) => ({ testCode, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      ok: true,
      filters: {
        start: start || null,
        end: end || null,
        facilityId: facilityId || null,
        regionId: regionId || null,
      },

      // ✅ هذا القسم “جاهز للواجهة” (مثل الصورة)
      uploadSummary: {
        uploads: totals.uploads,
        rowsTotal: totals.rowsTotal,
        accepted: totals.accepted,
        rejected: totals.rejected,
        ignored: totals.ignored,
        errors: totals.errors,
        duplicates: totals.duplicates,
        totalSizeBytes: totals.totalSizeBytes,
      },

      testsByCode,
      byFacility: agg?.byFacility || [],
      byRegion: agg?.byRegion || [],

      files: files.map((f) => ({
        id: String(f._id),
        createdAt: f.createdAt,
        facilityId: f.facilityId || null,
        regionId: f.regionId || null,
        originalName: f.originalName,
        storedName: f.storedName,
        sizeBytes: f.sizeBytes || 0,
        dateRange: f.dateRange || { start: null, end: null },

        // ✅ نفس مفاتيح الشاشة
        rowsTotal: f.rowsTotal || 0,
        accepted: f.accepted || 0,
        rejected: f.rejected || 0,
        ignored: f.ignored || 0,
        errors: f.errors || 0,
        duplicates: f.duplicates || 0,

        totalTests: f.totalTests || 0,
      })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
