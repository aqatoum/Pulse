/**
 * Build a consensus decision from multiple method interpretations
 *
 * Rule (simple & explainable):
 * - If ≥ 2 methods say "alert" → alert
 * - Else if ≥ 1 method says "watch" → watch
 * - Else → info
 */
function buildConsensus({ interpretations = {}, methods = [] }) {
  let alertCount = 0;
  let watchCount = 0;

  const perMethod = {};

  for (const m of methods) {
    const interp = interpretations[m];
    if (!interp) continue;

    perMethod[m] = {
      alertLevel: interp.alertLevel,
      confidenceLevel: interp.confidenceLevel,
    };

    if (interp.alertLevel === "alert") alertCount++;
    if (interp.alertLevel === "watch") watchCount++;
  }

  let decision = "info";
  if (alertCount >= 2) decision = "alert";
  else if (watchCount >= 1) decision = "watch";

  return {
    decision,
    counts: { alert: alertCount, watch: watchCount },
    perMethod,
  };
}

/**
 * Generate a human-friendly explanation of the consensus
 */
function buildSignatureInsight({ signalType, consensus, methods, language = "en" }) {
  const { decision, counts } = consensus;

  if (language === "ar") {
    return {
      title: "الاستنتاج النهائي للإشارة",
      narrative: `تم تحليل إشارة ${signalType} باستخدام الطرق التالية: ${methods.join(
        "، "
      )}. أظهرت ${counts.alert} طريقة مستوى إنذار مرتفع و${counts.watch} طريقة مستوى مراقبة. بناءً على ذلك، تم تصنيف الحالة على أنها: ${decision}.`,
      rationale: [
        "يعتمد القرار على توافق أكثر من خوارزمية مستقلة.",
        "يساعد هذا النهج على تقليل الإنذارات الكاذبة.",
      ],
    };
  }

  return {
    title: "Final Signal Assessment",
    narrative: `The ${signalType} signal was analyzed using the following methods: ${methods.join(
      ", "
    )}. ${counts.alert} method(s) indicated an alert level and ${counts.watch} indicated a watch level. Based on this agreement, the overall classification is: ${decision}.`,
    rationale: [
      "The decision is based on agreement across independent analytical methods.",
      "This ensemble approach reduces false alarms and improves reliability.",
    ],
  };
}

module.exports = {
  buildConsensus,
  buildSignatureInsight,
};
