const { getSignal } = require("./signalRegistry");

/**
 * Decide alert level (3-state) – must remain compatible with consensus:
 * info / watch / alert  :contentReference[oaicite:4]{index=4}
 */
function decideAlertLevel({ lastZ, UCL }) {
  if (UCL === null || typeof lastZ !== "number") return "info";
  if (lastZ > UCL) return "alert";
  if (lastZ > UCL * 0.85) return "watch"; // existing behavior :contentReference[oaicite:5]{index=5}
  return "info";
}

/**
 * 4-band risk indicator (0..3) for UI clarity.
 * This does NOT replace alertLevel; it complements it.
 *
 * Band idea (relative to UCL):
 * 0: Stable            (<= 0.70 UCL)
 * 1: Guarded           (0.70 .. 0.85 UCL)
 * 2: Watch             (0.85 .. 1.00 UCL)
 * 3: Alert             (>  1.00 UCL)
 */
function riskBand4({ lastZ, UCL }) {
  if (UCL === null || typeof lastZ !== "number" || UCL <= 0) return 0;
  const r = lastZ / UCL;
  if (r > 1.0) return 3;
  if (r >= 0.85) return 2;
  if (r >= 0.70) return 1;
  return 0;
}

function riskBandLabel(lang, band) {
  const b = Number(band || 0);
  const ar = ["مستقر", "حذر", "مراقبة", "إنذار"];
  const en = ["Stable", "Guarded", "Watch", "Alert"];
  return (lang === "ar" ? ar : en)[Math.max(0, Math.min(3, b))];
}

/**
 * Estimate confidence level based on data sufficiency and consistency
 */
function decideConfidence({ points = [], recentN = 0 }) {
  const weeks = points.length;

  if (weeks >= 8 && recentN >= 20) {
    return { level: "high", label: "High confidence" };
  }

  if (weeks >= 4 && recentN >= 10) {
    return { level: "medium", label: "Moderate confidence" };
  }

  return { level: "low", label: "Low confidence (limited data)" };
}

function confidenceLabel(lang, level) {
  const v = String(level || "low").toLowerCase();
  if (lang === "ar") {
    if (v === "high") return "ثقة عالية";
    if (v === "medium") return "ثقة متوسطة";
    return "ثقة منخفضة";
  }
  if (v === "high") return "High confidence";
  if (v === "medium") return "Moderate confidence";
  return "Low confidence";
}

/**
 * Main Interpretation Generator
 */
function generateInterpretation({
  language = "en",
  signalType,
  method,
  lastZ,
  UCL,
  points = [],
  recentN = 0,
  // extra meta (optional)
  preset = null,
  timeRange = null,
}) {
  const signal = getSignal(signalType);

  if (!signal) {
    return {
      title: language === "ar" ? "إشارة غير معرّفة" : "Undefined signal",
      summary:
        language === "ar"
          ? "لم يتم العثور على تعريف علمي لهذه الإشارة."
          : "No scientific definition was found for this signal.",
      alertLevel: "info",
      riskBand: 0,
      riskLabel: riskBandLabel(language, 0),
      confidenceLevel: "low",
      confidenceLabel: language === "ar" ? "ثقة منخفضة" : "Low confidence",
      recommendedActions: [],
      disclaimer:
        language === "ar"
          ? "هذا التفسير آلي ومخصص لأغراض دعم القرار فقط."
          : "This interpretation is automated and intended for decision support only.",
      meta: { preset, timeRange },
    };
  }

  const alertLevel = decideAlertLevel({ lastZ, UCL });
  const band = riskBand4({ lastZ, UCL });
  const confidence = decideConfidence({ points, recentN });

  const title =
    language === "ar" ? `مؤشر ${signal.description.ar}` : `${signal.description.en}`;

  const rangeTxt =
    timeRange?.start || timeRange?.end
      ? language === "ar"
        ? ` ضمن نطاق زمني (${timeRange.start || "—"} → ${timeRange.end || "—"})`
        : ` within a time range (${timeRange.start || "—"} → ${timeRange.end || "—"})`
      : "";

  const presetTxt =
    preset
      ? language === "ar"
        ? ` (حساسية: ${preset})`
        : ` (sensitivity: ${preset})`
      : "";

  const summary =
    language === "ar"
      ? `تم تحليل بيانات ${signal.biomarker} باستخدام طريقة ${method}${rangeTxt}${presetTxt}. مستوى الإشارة: ${alertLevel}. مستوى الخطر (4 مستويات): ${riskBandLabel(
          language,
          band
        )}.`
      : `${signal.biomarker} data were analyzed using the ${method} method${rangeTxt}${presetTxt}. Signal level: ${alertLevel}. Risk (4-band): ${riskBandLabel(
          language,
          band
        )}.`;

  const recommendedActions =
    signal.defaultActions?.[alertLevel]?.[language] || [];

  const disclaimer =
    language === "ar"
      ? "هذا التحليل آلي ويهدف إلى دعم القرار الصحي السكاني ولا يُعد تشخيصًا فرديًا."
      : "This analysis is automated and intended to support population-level public health decisions, not individual diagnosis.";

  return {
    signal: signalType,
    method,
    alertLevel, // 3-state for consensus
    riskBand: band, // 4-state for UI clarity
    riskLabel: riskBandLabel(language, band),
    confidenceLevel: confidence.level,
    confidenceLabel: confidenceLabel(language, confidence.level),
    title,
    summary,
    recommendedActions,
    disclaimer,
    meta: { preset, timeRange, lastZ, UCL },
  };
}

module.exports = {
  generateInterpretation,
  decideAlertLevel,
  decideConfidence,
};
