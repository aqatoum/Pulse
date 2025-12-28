// apps/pulse-api/src/services/reports/explainReport/explainReport.service.js

const { T } = require("./templates");
const { classify } = require("./mlClassifier");

function isoNow() {
  return new Date().toISOString();
}

function mean(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildFeatures({ ewma, cusum }) {
  const points = ewma?.points || [];
  const weeksTotal = points.length;

  const ns = points.map((p) => Number(p.n || 0));
  const meanWeeklyN = mean(ns);

  const alerts = points.filter((p) => p.alert).length;

  // consecutive alert weeks
  let consec = 0;
  let bestConsec = 0;
  for (const p of points) {
    if (p.alert) {
      consec += 1;
      bestConsec = Math.max(bestConsec, consec);
    } else {
      consec = 0;
    }
  }

  // max z
  let maxZ = null;
  for (const p of points) {
    const z = Number(p.z);
    if (Number.isFinite(z)) maxZ = maxZ === null ? z : Math.max(maxZ, z);
  }

  // missing weeks (if you represent missing by n=0 or no point; here: count n==0)
  const missingWeeks = points.filter((p) => Number(p.n || 0) === 0).length;

  // cusum (optional): if you have cusum alerts, incorporate later
  const weeksWithAlert = alerts; // start with EWMA only

  return {
    weeksTotal,
    meanWeeklyN,
    weeksWithAlert,
    consecutiveAlertWeeks: bestConsec,
    maxZ,
    missingWeeks,
  };
}

function renderReportText({ lang, signalLabel, facilityId, timeRange, methods, statusKey, howList, notes }) {
  const L = (lang || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
  const tt = T[L];

  const s = tt.status[statusKey] || tt.status.INSUFFICIENT;

  const lines = [];
  lines.push(tt.title(signalLabel));
  lines.push("");

  lines.push(tt.sections.header);
  lines.push(tt.common.generatedAt(isoNow()));
  lines.push(tt.common.facility(facilityId));
  lines.push(tt.common.range(timeRange));
  lines.push(tt.common.agg(L === "ar" ? "أسبوعي" : "Weekly"));
  lines.push(tt.common.methods(methods));
  lines.push("");

  lines.push(tt.sections.summary);
  lines.push(s.summary);
  lines.push("");

  lines.push(tt.sections.what);
  lines.push(s.what);
  lines.push("");

  lines.push(tt.sections.how);
  howList.forEach((h) => lines.push(`- ${h}`));
  lines.push("");

  lines.push(tt.sections.confidence);
  lines.push(s.confidence);
  lines.push("");

  lines.push(tt.sections.limitations);
  lines.push(tt.limitations(notes));
  lines.push("");

  lines.push(tt.sections.governance);
  lines.push(tt.governance);

  return lines.join("\n");
}

/**
 * generateExplanationReport
 * Inputs should be outputs from your existing analytics endpoints/services.
 */
function generateExplanationReport({
  lang,
  signalLabel = "Signal",
  facilityId,
  timeRange,
  ewma,
  cusum,
  profile,
}) {
  const features = buildFeatures({ ewma, cusum });
  const statusKey = classify(features);

  const L = (lang || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
  const tt = T[L];

  const howList = [];
  if (ewma) howList.push(tt.howLines.ewma);
  if (cusum) howList.push(tt.howLines.cusum);

  // notes & limitations
  const notes = [];
  const overallN = profile?.profile?.overall?.n ?? profile?.overall?.n;
  if (Number.isFinite(overallN) && overallN < 200) {
    notes.push(L === "ar" ? "حجم البيانات الإجمالي محدود وقد يؤثر على ثبات الإشارة." : "Overall data volume is limited and may affect signal stability.");
  }
  if ((features.meanWeeklyN || 0) < 20) {
    notes.push(L === "ar" ? "متوسط عدد الفحوصات الأسبوعي منخفض؛ يُنصح بتوسيع الفترة أو دمج مصادر إضافية." : "Average weekly volume is low; consider expanding the period or adding more sources.");
  }
  if ((features.missingWeeks || 0) > 0) {
    notes.push(L === "ar" ? "هناك أسابيع بدون بيانات أو بعدد فحوصات صفر؛ قد يسبب ذلك تذبذبًا مصطنعًا." : "Some weeks have missing/zero data; this may introduce artificial fluctuation.");
  }

  const methods = [ewma ? "EWMA" : null, cusum ? "CUSUM" : null].filter(Boolean).join(", ") || (L === "ar" ? "غير متاح" : "N/A");

  const reportText = renderReportText({
    lang,
    signalLabel,
    facilityId,
    timeRange,
    methods,
    statusKey,
    howList,
    notes,
  });

  return {
    ok: true,
    reportType: "EXPLANATION_REPORT",
    status: statusKey,          // STABLE / ATTENTION / ALERT / INSUFFICIENT
    features,                   // للشفافية والتدقيق
    reportText,                 // النص النهائي
  };
}

module.exports = { generateExplanationReport };
