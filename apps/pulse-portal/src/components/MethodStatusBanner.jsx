import React from "react";

export default function MethodStatusBanner({ title, status, lang = "ar" }) {
  const ok = status?.ok === true;
  if (ok) return null;

  const reason = status?.reason || "INSUFFICIENT_DATA";

  const msgAr =
    reason === "NOT_ENOUGH_HISTORY"
      ? "لا توجد بيانات تاريخية كافية (نفس الأشهر عبر السنوات) لإجراء هذا التحليل."
      : reason === "NEED_ONE_YEAR_COVERAGE"
      ? "لا توجد تغطية زمنية كافية (يلزم بيانات تقارب سنة)."
      : reason === "REFERENCE_YEAR_NOT_COMPLETE"
      ? "لا توجد سنة مرجعية كاملة (12 شهرًا) للمقارنة الموسمية."
      : reason === "NO_OVERLAP_MONTHS"
      ? "لا يوجد تداخل أشهر كافٍ بين سنة الهدف والسنة المرجعية."
      : reason === "NO_CLINICAL_THRESHOLDS"
      ? "لا توجد عتبات سريرية معرفة لهذا الفحص بعد."
      : reason === "NO_POINTS"
      ? "لم يتم توليد نقاط تحليل (قد تكون البيانات غير كافية أو غير مطابقة للفحص المختار)."
      : "لا توجد بيانات كافية لإجراء التحليل.";

  const msgEn =
    reason === "NOT_ENOUGH_HISTORY"
      ? "Insufficient seasonal history (same months across years) to run this method."
      : reason === "NEED_ONE_YEAR_COVERAGE"
      ? "Insufficient time coverage (about 1 year is required)."
      : reason === "REFERENCE_YEAR_NOT_COMPLETE"
      ? "No complete reference year (12 months) available for seasonal comparison."
      : reason === "NO_OVERLAP_MONTHS"
      ? "No sufficient overlapping months between target and reference year."
      : reason === "NO_CLINICAL_THRESHOLDS"
      ? "No clinical thresholds defined for this test yet."
      : reason === "NO_POINTS"
      ? "No analysis points were produced (data may be insufficient or mismatched)."
      : "Insufficient data to run this method.";

  const msg = lang === "ar" ? msgAr : msgEn;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255, 200, 80, 0.25)",
        background: "rgba(255, 200, 80, 0.08)",
        color: "rgba(255,255,255,0.92)",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 4 }}>
        {lang === "ar" ? `تنبيه: ${title}` : `Notice: ${title}`}
      </div>

      <div>{msg}</div>

      {status && (
        <div style={{ opacity: 0.85, marginTop: 6, fontSize: 12 }}>
          {lang === "ar" ? "تفاصيل: " : "Details: "}
          {reason}
          {typeof status.okMonths === "number" && <> • okMonths={status.okMonths}</>}
          {typeof status.monthsTotal === "number" && <> • monthsTotal={status.monthsTotal}</>}
          {typeof status.minHistoryYears === "number" && <> • minHistoryYears={status.minHistoryYears}</>}
        </div>
      )}
    </div>
  );
}
