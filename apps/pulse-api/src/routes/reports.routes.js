// apps/pulse-api/src/routes/reports.routes.js
const express = require("express");

const { apiOk, apiError } = require("../utils/response");

// ✅ هذا هو المجمّع الحالي في مشروعك (هو المرجّح أنه يبني نفس مخرجات اللوحة)
const reportService = require("../services/analytics/report.service");

// ✅ مولّد التقرير السردي (أنت عدّلته سابقًا)
const { buildNarrativeReport } = require("../services/reports/narrativeReport.service");

const router = express.Router();

/**
 * نلتقط الدالة الصحيحة من report.service.js بدون ما نكسر مشروعك
 * لأن أسماء الدوال تختلف بين النسخ.
 */
function pickReportBuilder(svc) {
  const candidates = [
    "buildSignalReport",
    "buildAnalyticsReport",
    "buildReport",
    "getReport",
    "generateReport",
    "computeReport",
  ];

  for (const name of candidates) {
    if (typeof svc?.[name] === "function") return svc[name];
  }

  // إذا لم نجد دالة، نُرجع null (والرسالة ستظهر واضحة)
  return null;
}

/**
 * GET /api/reports/:signal?facilityId=...&lang=ar|en&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * الهدف: تقرير سردي مطابق 100% للإشارة
 * - نأخذ bundle جاهز من report.service.js (نفس اللي تعتمد عليه لوحة التحليل)
 * - ثم نحوله إلى narrative report بدون إعادة حساب المعادلات
 */
router.get("/:signal", async (req, res) => {
  try {
    const signal = String(req.params.signal || "").trim().toLowerCase();
    const facilityId = String(req.query.facilityId || "").trim();
    const lang = String(req.query.lang || "ar").toLowerCase() === "en" ? "en" : "ar";

    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    if (!signal) return apiError(res, 400, "Missing signal");
    if (!facilityId) return apiError(res, 400, "Missing facilityId");

    const buildBundle = pickReportBuilder(reportService);
    if (!buildBundle) {
      return apiError(
        res,
        500,
        `report.service.js has no known builder function. Exports: ${Object.keys(reportService || {}).join(", ")}`
      );
    }

    // ✅ نبني Bundle من نفس خدمة التحليل الحالية
    // ملاحظة: نمرّر بارامترات مرنة حتى تتوافق مع أكثر من شكل
    const bundle = await buildBundle({
      signal,
      signalType: signal,
      facilityId,
      scope: facilityId, // بعض النسخ تستخدم scope بدل facilityId
      lang,
      language: lang,
      dateRange: { from, to },
      from,
      to,
    });

    // ✅ نحوّل bundle إلى تقرير سردي (بدون أي حسابات جديدة)
    const report = buildNarrativeReport({ lang, bundle });

    return apiOk(res, {
      signal,
      facilityId,
      lang,
      dateRange: bundle?.dateRange || { from, to },
      generatedAt: new Date().toISOString(),
      report,
    });
  } catch (e) {
    return apiError(res, 500, e?.message || "Report generation failed");
  }
});

module.exports = router;
