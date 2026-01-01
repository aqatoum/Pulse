function isoNow() {
  return new Date().toISOString();
}

function up(x) {
  return String(x || "").toUpperCase();
}

function methodNiceName(m) {
  const k = String(m || "").toLowerCase();
  if (k === "ewma") return "EWMA";
  if (k === "cusum") return "CUSUM";
  if (k === "farrington") return "Farrington";
  return up(k);
}

function joinMethods(methodsUsed) {
  const arr = Array.isArray(methodsUsed) ? methodsUsed : [];
  const out = arr.map(methodNiceName);
  return out.length ? out.join(", ") : "—";
}

function decisionWord(decision, lang) {
  const d = String(decision || "info").toLowerCase();
  const isAr = String(lang || "en").toLowerCase() === "ar";

  if (isAr) {
    if (d === "alert") return "إنذار";
    if (d === "watch") return "مراقبة";
    return "معلومات";
  } else {
    if (d === "alert") return "Alert";
    if (d === "watch") return "Watch";
    return "Info";
  }
}

function buildPlainSummary({ lang, consensus }) {
  const isAr = String(lang || "en").toLowerCase() === "ar";
  const d = decisionWord(consensus?.decision, lang);
  const alertCount = consensus?.counts?.alert ?? null;
  const watchCount = consensus?.counts?.watch ?? null;

  if (isAr) {
    const parts = [];
    parts.push(`الخلاصة: تصنيف النظام = ${d}.`);
    if (typeof alertCount === "number" && typeof watchCount === "number") {
      parts.push(`(عدد الإنذارات: ${alertCount}، عدد إشارات المراقبة: ${watchCount})`);
    }
    return parts.join(" ");
  }

  const parts = [];
  parts.push(`Summary: System classification = ${d}.`);
  if (typeof alertCount === "number" && typeof watchCount === "number") {
    parts.push(`(Alerts: ${alertCount}, Watch: ${watchCount})`);
  }
  return parts.join(" ");
}

function buildHowDetected({ lang, methodsUsed }) {
  const isAr = String(lang || "en").toLowerCase() === "ar";
  const arr = Array.isArray(methodsUsed) ? methodsUsed : [];
  const lines = [];

  for (const m of arr) {
    const k = String(m || "").toLowerCase();
    if (k === "ewma") {
      lines.push(isAr ? "- EWMA: لرصد التغيرات التدريجية أو المستمرة عبر الزمن." : "- EWMA: Detects gradual/sustained shifts over time.");
    } else if (k === "cusum") {
      lines.push(isAr ? "- CUSUM: يرصد الانحرافات الصغيرة التي تتراكم مع الوقت." : "- CUSUM: Detects small persistent changes that accumulate.");
    } else if (k === "farrington") {
      lines.push(isAr ? "- Farrington: يقارن الأسبوع الحالي بخط أساس تاريخي لرصد زيادات/انحرافات غير معتادة." : "- Farrington: Compares current week vs historical baseline to flag unusual deviations.");
    }
  }

  return lines.length ? lines.join("\n") : (isAr ? "- لا توجد طرق." : "- No methods.");
}

function buildConfidence({ lang, dataQuality, consensus }) {
  const isAr = String(lang || "en").toLowerCase() === "ar";
  const weeks = dataQuality?.weeksCoverage ?? null;
  const n = dataQuality?.overallN ?? null;

  const d = String(consensus?.decision || "info").toLowerCase();

  // simple explainable text (no fake ML)
  if (isAr) {
    const parts = [];
    parts.push("الثبات والموثوقية");
    parts.push(
      "ترتفع الثقة عندما يكون الانحراف ممتدًا عبر عدة أسابيع، ويظهر عبر أكثر من طريقة، ومع حجم عينات أسبوعي مناسب."
    );
    if (typeof n === "number" && typeof weeks === "number") {
      parts.push(`(حجم البيانات: ${n} فحص، تغطية: ${weeks} أسبوع)`);
    }
    if (d === "alert" && (weeks || 0) < 4) {
      parts.push("ملاحظة: التغطية الزمنية قصيرة؛ يُنصح باعتبار النتيجة للمراقبة حتى تتوفر أسابيع إضافية.");
    }
    return parts.join("\n");
  }

  const parts = [];
  parts.push("Stability & confidence");
  parts.push("Confidence increases when deviation persists across multiple weeks, is supported by more than one method, and weekly volume is sufficient.");
  if (typeof n === "number" && typeof weeks === "number") {
    parts.push(`(Data volume: ${n} tests, coverage: ${weeks} weeks)`);
  }
  if (d === "alert" && (weeks || 0) < 4) {
    parts.push("Note: short time coverage; consider treating as monitoring until more weeks are available.");
  }
  return parts.join("\n");
}

/**
 * generateExplanationReport
 * Deterministic, professional template report (NOT an ML model).
 */
function generateExplanationReport({
  lang = "en",
  signalType,
  testCode,
  signalLabel,
  facilityId,
  timeRange,
  aggregation = "Weekly",
  methodsUsed = [],
  consensus = {},
  ewma,
  cusum,
  farrington,
  dataQuality,
}) {
  const isAr = String(lang).toLowerCase() === "ar";

  const title = isAr
    ? `تقرير تفسيري مبني على التحليل الإحصائي — ${signalLabel || "إشارة"}`
    : `Statistical Explanation Report (Non-technical) — ${signalLabel || "Signal"}`;

  const methodsLine = joinMethods(methodsUsed);

  const infoBlock = isAr
    ? [
        "معلومات التقرير",
        `تاريخ الإنشاء: ${isoNow()}`,
        `الجهة/المركز: ${facilityId || "—"}`,
        `النطاق الزمني: ${new Date().toLocaleString("ar-JO")}`
        `مستوى التجميع: ${aggregation === "Weekly" ? "أسبوعي" : aggregation}`,
        `الفحص: ${testCode || "—"} • الإشارة: ${signalType || "—"}`,
        `الطرق المستخدمة: ${methodsLine}`,
      ].join("\n")
    : [
        "Report info",
        `Generated: ${isoNow()}`,
        `Facility: ${facilityId || "—"}`,
        `Time range: ${timeRange ? timeRange : "All available data"}`,
        `Aggregation: ${aggregation}`,
        `Test: ${testCode || "—"} • Signal: ${signalType || "—"}`,
        `Methods: ${methodsLine}`,
      ].join("\n");

  const summary = isAr
    ? ["ملخص مبسّط (لغير المتخصص)", buildPlainSummary({ lang, consensus })].join("\n")
    : ["Plain-language summary", buildPlainSummary({ lang, consensus })].join("\n");

  const whatDataShows = isAr
    ? [
        "ماذا نرى في البيانات؟",
        "الملخص هنا يعتمد على قرار التوافق (Consensus) عبر الطرق المختارة، وليس على طريقة واحدة فقط.",
        "للتفاصيل الدقيقة راجع الرسوم البيانية والتقسيم السكاني في لوحة التحكم.",
      ].join("\n")
    : [
        "What the data shows",
        "This summary follows the consensus across selected methods (not a single-method flag).",
        "For details, review charts and stratification in the dashboard.",
      ].join("\n");

  const howDetected = isAr
    ? ["كيف تم رصد ذلك؟", buildHowDetected({ lang, methodsUsed })].join("\n")
    : ["How this was detected", buildHowDetected({ lang, methodsUsed })].join("\n");

  const confidence = buildConfidence({ lang, dataQuality, consensus });

  const dataNotes = isAr
    ? [
        "ملاحظات وحدود البيانات",
        "- هذا التقرير لا يشخص أفرادًا ولا يقدم توصيات علاجية.",
        "- يُفسَّر ضمن السياق الصحي والميداني ومعرفة المختصين.",
      ].join("\n")
    : [
        "Data notes & limitations",
        "- This report does not diagnose individuals or provide treatment guidance.",
        "- Interpret within clinical/public-health context with expert oversight.",
      ].join("\n");

  const usage = isAr
    ? [
        "حدود الاستخدام",
        "هذا التقرير يقدم مؤشرات تحليلية على مستوى السكان فقط. يلزم تفسيره من قبل مختصين ضمن السياق.",
      ].join("\n")
    : [
        "Usage boundaries",
        "Population-level indicators only. Expert contextual interpretation is required.",
      ].join("\n");

  // optional: mention which method objects are present (helps debugging)
  const present = [];
  if (ewma) present.push("EWMA");
  if (cusum) present.push("CUSUM");
  if (farrington) present.push("Farrington");
  const debugLine = isAr
    ? `\n(تم تضمين النتائج: ${present.length ? present.join(", ") : "—"})`
    : `\n(Results included: ${present.length ? present.join(", ") : "—"})`;

  const reportText = [
    title,
    "",
    infoBlock,
    "",
    summary,
    "",
    whatDataShows,
    "",
    howDetected,
    "",
    confidence,
    "",
    dataNotes,
    "",
    usage,
    debugLine,
  ].join("\n");

  return { reportText };
}

module.exports = { generateExplanationReport };
