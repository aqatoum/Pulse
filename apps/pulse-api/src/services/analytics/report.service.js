const { getSignal } = require("./signalRegistry");

function pct(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  return Math.round(x * 100);
}

function safe(v, fallback = "N/A") {
  return v === null || v === undefined || v === "" ? fallback : v;
}

function normalizeLang(lang) {
  const l = String(lang || "en").toLowerCase();
  if (l === "ar" || l === "en" || l === "both") return l;
  return "en";
}

// Simple, defensible confidence heuristic
function computeConfidence({ overallN, weeksCount, hasBaselineVariance }) {
  // weeksCount may be unknown here; caller can pass it later. We keep it optional.
  const w = typeof weeksCount === "number" && Number.isFinite(weeksCount) ? weeksCount : null;

  if (overallN >= 50 && (w === null || w >= 8) && hasBaselineVariance) return "high";
  if (overallN >= 20 && (w === null || w >= 4)) return "moderate";
  return "low";
}

function confidenceLabel(lang, level) {
  const l = normalizeLang(lang);
  const v = String(level || "low").toLowerCase();
  const mapEn = {
    high: "High confidence",
    moderate: "Moderate confidence",
    low: "Low confidence"
  };
  const mapAr = {
    high: "ثقة عالية",
    moderate: "ثقة متوسطة",
    low: "ثقة منخفضة"
  };
  return l === "ar" ? (mapAr[v] || mapAr.low) : (mapEn[v] || mapEn.low);
}

function decisionLabel(lang, decision) {
  const l = normalizeLang(lang);
  const d = String(decision || "info").toLowerCase();
  if (l === "ar") {
    if (d === "alert") return "إنذار";
    if (d === "watch") return "مراقبة";
    return "معلومات";
  }
  if (d === "alert") return "ALERT";
  if (d === "watch") return "WATCH";
  return "INFO";
}

function recommendedActionByDecision(lang, decision) {
  const l = normalizeLang(lang);
  const d = String(decision || "info").toLowerCase();

  if (l === "ar") {
    if (d === "alert") {
      return "إجراء فوري: تدقيق سريع للبيانات (اكتمال/تكرار/تواريخ)، مراجعة موجهة للفئات الأعلى خطورة، وإبلاغ فريق الصحة العامة لبدء استجابة مركزة.";
    }
    if (d === "watch") {
      return "إجراء احترازي: تعزيز المراقبة خلال الأسابيع القادمة، تدقيق جودة البيانات، ومراجعة عوامل الخطر التغذوية للفئات الأكثر تأثرًا.";
    }
    return "إجراء روتيني: الاستمرار في المراقبة الدورية وتحسين جودة التسجيل والاكتمال.";
  }

  if (d === "alert") {
    return "Immediate action: verify data quality (completeness/duplicates/dates), review the highest-risk strata, and notify public health stakeholders for a focused response.";
  }
  if (d === "watch") {
    return "Precautionary action: increase monitoring over coming weeks, verify data quality, and review nutrition-related risk factors in the most affected strata.";
  }
  return "Routine action: continue monitoring and strengthen data completeness and standardization.";
}

function buildReportText({
  facilityId,
  signalType,
  methods = [],
  consensus,
  signatureInsight,
  profile,
  lang = "en",
  // optional: if later you pass more meta
  weeksCount = null, // number of time-buckets used (if known)
  baselineStd = null // if known from a method (EWMA etc.)
}) {
  const L = normalizeLang(lang);
  const sig = getSignal(signalType);

  const overallN = profile?.overall?.n ?? 0;
  const overallLow = profile?.overall?.low ?? 0;
  const overallRate = profile?.overall?.lowRate ?? null;

  // Data quality notes (defensible and simple)
  const smallN = overallN < 20;
  const subgroupMinN = 10;

  const top = Array.isArray(profile?.byAgeSex)
    ? profile.byAgeSex
        .filter(g => (g.n ?? 0) >= subgroupMinN && typeof g.lowRate === "number")
        .sort((a, b) => b.lowRate - a.lowRate)[0]
    : null;

  const decision = consensus?.decision || "info";
  const counts = consensus?.counts || { alert: 0, watch: 0 };

  const methodList = methods.map(m => String(m).toUpperCase()).join(L === "ar" ? "، " : ", ");

  const sigNameEn = sig?.description?.en || signalType;
  const sigNameAr = sig?.description?.ar || signalType;

  // Pull narrative insight if already generated
  const insightEn =
    typeof signatureInsight?.en?.narrative === "string" ? signatureInsight.en.narrative : null;
  const insightAr =
    typeof signatureInsight?.ar?.narrative === "string" ? signatureInsight.ar.narrative : null;

  const hasBaselineVariance =
    typeof baselineStd === "number" ? baselineStd > 0 : true; // default true if unknown

  const conf = computeConfidence({ overallN, weeksCount, hasBaselineVariance });
  const confLabel = confidenceLabel(L, conf);

  const headerEn = "PULSE Surveillance Narrative Report";
  const headerAr = "تقرير سردي من نظام PULSE للمراقبة الصحية";

  const topTextEn = top
    ? `Highest subgroup rate: age ${top.ageBand}, sex ${top.sex} (${pct(top.lowRate)}% based on ${top.n} tests).`
    : `No subgroup currently has ≥${subgroupMinN} samples to support a strong comparison.`;

  const topTextAr = top
    ? `أعلى نسبة ضمن الفئات: العمر ${top.ageBand} والجنس ${top.sex} (حوالي ${pct(top.lowRate)}% بناءً على ${top.n} فحوصات).`
    : `لا توجد فئة لديها ≥${subgroupMinN} فحوصات حاليًا لإجراء مقارنة قوية.`;

  const dataQualityEn = [
    `Data quality notes:`,
    `- Sample size: ${overallN} tests (small-N risk: ${smallN ? "YES" : "NO"}).`,
    weeksCount !== null ? `- Time coverage: ${weeksCount} time-buckets.` : null,
    `- Subgroup comparisons require sufficient samples (≥${subgroupMinN}).`
  ]
    .filter(Boolean)
    .join("\n");

  const dataQualityAr = [
    `ملاحظات جودة البيانات:`,
    `- حجم العينة: ${overallN} فحصًا (خطر العينة الصغيرة: ${smallN ? "نعم" : "لا"}).`,
    weeksCount !== null ? `- التغطية الزمنية: ${weeksCount} وحدات زمنية.` : null,
    `- المقارنات بين الفئات تتطلب عينة كافية (≥${subgroupMinN}).`
  ]
    .filter(Boolean)
    .join("\n");

  const disclaimerEn =
    "Disclaimer: This output supports population-level decision-making and surveillance. It is not an individual diagnosis. Interpret signals in context (reporting delays, testing patterns, and data completeness).";

  const disclaimerAr =
    "تنبيه: هذا الناتج مخصص لدعم القرار على مستوى السكان والمراقبة الصحية، وليس تشخيصًا فرديًا. يجب تفسير الإشارات ضمن السياق (تأخر الإبلاغ، نمط الفحوصات، واكتمال البيانات).";

  const decisionLineEn = `Ensemble decision: ${decisionLabel("en", decision)} (alerts=${counts.alert}, watch=${counts.watch}).`;
  const decisionLineAr = `القرار التجميعي: ${decisionLabel("ar", decision)} (إنذار=${counts.alert}، مراقبة=${counts.watch}).`;

  const summaryLineEn =
    `Data summary: ${overallN} tests; ${overallLow} low-signal cases` +
    ` (overall rate ${overallRate !== null ? pct(overallRate) + "%" : "N/A"}).`;

  const summaryLineAr =
    `ملخص البيانات: ${overallN} فحصًا؛ ${overallLow} حالات منخفضة/غير طبيعية` +
    ` (المعدل الإجمالي ${overallRate !== null ? pct(overallRate) + "%" : "غير متاح"}).`;

  const coreEn =
    `${headerEn}\n` +
    `Facility: ${facilityId}\n` +
    `Signal: ${safe(sigNameEn)}\n` +
    `Methods: ${safe(methodList)}\n` +
    `${summaryLineEn}\n` +
    `${decisionLineEn}\n` +
    `Confidence: ${confLabel}\n\n` +
    `${safe(insightEn, "A multi-method ensemble was used to improve reliability and reduce false alarms.")}\n` +
    `${topTextEn}\n\n` +
    `${dataQualityEn}\n\n` +
    `Recommended action: ${recommendedActionByDecision("en", decision)}\n\n` +
    `${disclaimerEn}`;

  const coreAr =
    `${headerAr}\n` +
    `المنشأة: ${facilityId}\n` +
    `الإشارة: ${safe(sigNameAr, "غير محدد")}\n` +
    `الطرق المستخدمة: ${safe(methodList, "غير محدد")}\n` +
    `${summaryLineAr}\n` +
    `${decisionLineAr}\n` +
    `مستوى الثقة: ${confLabel}\n\n` +
    `${safe(insightAr, "تم استخدام أكثر من خوارزمية لرفع الموثوقية وتقليل الإنذارات الكاذبة.")}\n` +
    `${topTextAr}\n\n` +
    `${dataQualityAr}\n\n` +
    `الإجراء المقترح: ${recommendedActionByDecision("ar", decision)}\n\n` +
    `${disclaimerAr}`;

  return L === "ar" ? coreAr : coreEn;
}

/**
 * Backward compatible wrapper:
 * - lang=en => returns string
 * - lang=ar => returns string
 * - lang=both => returns { ar: string, en: string } (internal/testing only)
 */
function buildReport(args) {
  const L = normalizeLang(args?.lang);
  if (L === "both") {
    return {
      ar: buildReportText({ ...args, lang: "ar" }),
      en: buildReportText({ ...args, lang: "en" })
    };
  }
  return buildReportText({ ...args, lang: L });
}

module.exports = { buildReport, buildReportText };
