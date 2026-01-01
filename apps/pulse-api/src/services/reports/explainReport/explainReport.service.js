/* =========================
   Date & helpers
   ========================= */

function formatNow(lang = "en") {
  const d = new Date();

  if (String(lang).toLowerCase() === "ar") {
    return d.toLocaleString("ar-JO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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

/* =========================
   Narrative blocks
   ========================= */

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
      lines.push(isAr ? "- Farrington: يقارن الأسبوع الحالي بخط أساس تاريخي لرصد زيادات غير معتادة." : "- Farrington: Compares current week vs historical baseline to flag unusual deviations.");
    }
  }

  return lines.length ? lines.join("\n") : (isAr ? "- لا توجد طرق." : "- No methods.");
}

function buildConfidence({ lang, dataQuality, consensus }) {
  const isAr = String(lang || "en").toLowerCase() === "ar";
  const weeks = dataQuality?.weeksCoverage ?? null;
  const n = dataQuality?.overallN ?? null;
  const d = String(consensus?.decision || "info").toLowerCase();

  if (isAr) {
    const parts = [];
    parts.push("الثبات والموثوقية");
    parts.push("ترتفع الثقة عندما يستمر الانحراف عبر عدة أسابيع ويظهر عبر أكثر من طريقة.");
    if (typeof n === "number" && typeof weeks === "number") {
      parts.push(`(حجم البيانات: ${n} فحص، التغطية: ${weeks} أسبوع)`);
    }
    if (d === "alert" && (weeks || 0) < 4) {
      parts.push("ملاحظة: التغطية الزمنية قصيرة؛ يوصى بالمراقبة.");
    }
    return parts.join("\n");
  }

  const parts = [];
  parts.push("Stability & confidence");
  parts.push("Confidence increases when deviation persists across weeks and multiple methods.");
  if (typeof n === "number" && typeof weeks === "number") {
    parts.push(`(Data volume: ${n} tests, coverage: ${weeks} weeks)`);
  }
  if (d === "alert" && (weeks || 0) < 4) {
    parts.push("Note: short time coverage; consider monitoring.");
  }
  return parts.join("\n");
}

/* =========================
   Main generator
   ========================= */

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
        `تاريخ الإنشاء: ${formatNow(lang)}`,
        `الجهة/المركز: ${facilityId || "—"}`,
        `النطاق الزمني: ${timeRange || "كامل البيانات المتاحة"}`,
        `مستوى التجميع: ${aggregation === "Weekly" ? "أسبوعي" : aggregation}`,
        `الفحص: ${testCode || "—"} • الإشارة: ${signalType || "—"}`,
        `الطرق المستخدمة: ${methodsLine}`,
      ].join("\n")
    : [
        "Report info",
        `Generated: ${formatNow(lang)}`,
        `Facility: ${facilityId || "—"}`,
        `Time range: ${timeRange || "All available data"}`,
        `Aggregation: ${aggregation}`,
        `Test: ${testCode || "—"} • Signal: ${signalType || "—"}`,
        `Methods: ${methodsLine}`,
      ].join("\n");

  const reportText = [
    title,
    "",
    infoBlock,
    "",
    isAr ? "ملخص مبسّط" : "Plain-language summary",
    buildPlainSummary({ lang, consensus }),
    "",
    isAr ? "كيف تم الرصد؟" : "How detected",
    buildHowDetected({ lang, methodsUsed }),
    "",
    buildConfidence({ lang, dataQuality, consensus }),
  ].join("\n");

  return { reportText };
}

module.exports = { generateExplanationReport };
