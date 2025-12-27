/**
 * Consensus (Ensemble) decision from multiple method interpretations
 *
 * Explainable rule:
 * - If >= 2 methods say "alert" -> alert
 * - Else if >= 1 method says "watch" -> attention
 * - Else -> stable
 *
 * Notes:
 * - We only count methods that actually returned an interpretation.
 * - We keep per-method details for transparency.
 * - We compute a conservative overall confidence:
 *   - High: at least 2 methods AND none are "low"
 *   - Medium: at least 2 methods OR mixed levels
 *   - Low: only 1 method available OR most are low
 */

function normLevel(x) {
  const v = String(x || "").toLowerCase().trim();
  if (v === "alert") return "alert";
  if (v === "watch" || v === "attention") return "watch";
  return "info";
}

function normConf(x) {
  const v = String(x || "").toLowerCase().trim();
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

/**
 * Build consensus from interpretations
 * interpretations example:
 * {
 *   EWMA: { alertLevel: "watch", confidenceLevel: "medium", ... },
 *   CUSUM:{ alertLevel: "alert", confidenceLevel: "high", ... },
 * }
 */
function buildConsensus({ interpretations = {}, methods = [] }) {
  let alertCount = 0;
  let watchCount = 0;

  const perMethod = {};
  const confCounts = { high: 0, medium: 0, low: 0 };

  const usedMethods = [];

  for (const m of methods) {
    const interp = interpretations?.[m];
    if (!interp) continue;

    const a = normLevel(interp.alertLevel);
    const c = normConf(interp.confidenceLevel);

    usedMethods.push(m);

    perMethod[m] = {
      alertLevel: a, // info|watch|alert
      confidenceLevel: c, // low|medium|high
      // Keep any extra fields if present (safe)
      details: interp.details || interp.meta || undefined,
    };

    if (a === "alert") alertCount++;
    if (a === "watch") watchCount++;

    confCounts[c] = (confCounts[c] || 0) + 1;
  }

  // If nothing returned, default stable with low confidence
  if (!usedMethods.length) {
    return {
      decision: "stable",
      confidence: "low",
      counts: { alert: 0, watch: 0, methodsUsed: 0 },
      methodsUsed: [],
      perMethod: {},
      rule: "no_methods",
    };
  }

  // Decision mapping: info/watch/alert -> stable/attention/alert
  let decision = "stable";
  if (alertCount >= 2) decision = "alert";
  else if (watchCount >= 1) decision = "attention";

  // Overall confidence (conservative, explainable)
  // - If only 1 method is available -> low by definition
  // - If multiple methods:
  //    - high if no low and at least one high
  //    - medium if mixed, or mostly medium
  //    - low if low dominates
  let confidence = "medium";
  const n = usedMethods.length;

  if (n === 1) {
    confidence = "low";
  } else {
    const hasLow = confCounts.low > 0;
    const hasHigh = confCounts.high > 0;

    if (!hasLow && hasHigh) confidence = "high";
    else if (confCounts.low >= Math.ceil(n / 2)) confidence = "low";
    else confidence = "medium";
  }

  return {
    decision, // stable|attention|alert
    confidence, // low|medium|high
    counts: { alert: alertCount, watch: watchCount, methodsUsed: usedMethods.length },
    methodsUsed: usedMethods,
    perMethod,
    rule: "2-alerts-or-1-watch",
  };
}

/**
 * Human-friendly explanation
 * signalType: e.g. "anemia" or "HB"
 */
function buildSignatureInsight({ signalType, consensus, methods, language = "en" }) {
  const { decision, confidence, counts, methodsUsed } = consensus;

  const label = (lang, d) => {
    const mapAr = { stable: "مستقرة", attention: "تحت المراقبة", alert: "إنذار" };
    const mapEn = { stable: "Stable", attention: "Under monitoring", alert: "Alert" };
    return (lang === "ar" ? mapAr : mapEn)[d] || d;
  };

  const confLabel = (lang, c) => {
    const mapAr = { high: "ثقة عالية", medium: "ثقة متوسطة", low: "ثقة منخفضة" };
    const mapEn = { high: "High confidence", medium: "Moderate confidence", low: "Low confidence" };
    return (lang === "ar" ? mapAr : mapEn)[c] || c;
  };

  // Only show methods that were actually used (returned interpretations)
  const used = Array.isArray(methodsUsed) && methodsUsed.length ? methodsUsed : [];
  const shownMethods = used.length ? used : (Array.isArray(methods) ? methods : []);

  if (language === "ar") {
    return {
      title: "التقييم النهائي للإشارة",
      narrative:
        `تم تحليل إشارة (${signalType}) باستخدام: ${shownMethods.join("، ")}. ` +
        `عدد الطرق التي أعطت إنذارًا: ${counts.alert}، وعدد طرق المراقبة: ${counts.watch}. ` +
        `بناءً على قاعدة توافق بسيطة (>=2 إنذار أو >=1 مراقبة)، تم تصنيف الحالة: ${label("ar", decision)}. ` +
        `مستوى الثقة: ${confLabel("ar", confidence)}.`,
      rationale: [
        "القرار مبني على توافق أكثر من خوارزمية مستقلة لتقليل الإنذارات الكاذبة.",
        "التقرير يوضح عدد الطرق المستخدمة فعليًا، وليس فقط الطرق المتاحة.",
        "هذه أداة دعم قرار على مستوى السكان وليست تشخيصًا فرديًا.",
      ],
    };
  }

  return {
    title: "Final Signal Assessment",
    narrative:
      `The (${signalType}) signal was analyzed using: ${shownMethods.join(", ")}. ` +
      `${counts.alert} method(s) indicated an alert level and ${counts.watch} indicated a watch level. ` +
      `Using an explainable agreement rule (>=2 alerts or >=1 watch), the overall classification is: ${label(
        "en",
        decision
      )}. ` +
      `Confidence: ${confLabel("en", confidence)}.`,
    rationale: [
      "Decision relies on agreement across independent methods to reduce false alarms.",
      "We report methods actually used (those that produced interpretations).",
      "Population-level decision support, not individual diagnosis.",
    ],
  };
}

module.exports = {
  buildConsensus,
  buildSignatureInsight,
};
