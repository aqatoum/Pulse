// apps/pulse-api/src/services/reports/narrativeReport.service.js
// PULSE — Narrative Report Service
// Produces a structured, non-diagnostic, population-level narrative aligned with:
// /14_NARRATIVE_REPORTS_STANDARD.md

const dayjs = require("dayjs");

function norm(x) {
  return String(x ?? "").trim();
}

function upper(x) {
  return norm(x).toUpperCase();
}

function clampNum(x, d = 4) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(d));
}

function pct(x, d = 1) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Number((n * 100).toFixed(d));
}

function safeArr(a) {
  return Array.isArray(a) ? a : [];
}

function latestPoint(points) {
  const pts = safeArr(points);
  return pts.length ? pts[pts.length - 1] : null;
}

function countAlerts(points) {
  return safeArr(points).filter((p) => p && p.alert).length;
}

function weeksCount(points) {
  return safeArr(points).length;
}

function sum(points, key) {
  return safeArr(points).reduce((acc, p) => acc + (Number(p?.[key]) || 0), 0);
}

function pickMethodPayload(analysis) {
  // Supports common shapes:
  // { cusum: { ... } } or { ewma: { ... } } or { farrington: { ... } }
  if (analysis?.cusum?.points) return { method: "CUSUM", payload: analysis.cusum };
  if (analysis?.ewma?.points) return { method: "EWMA", payload: analysis.ewma };
  if (analysis?.farrington?.points) return { method: "Farrington", payload: analysis.farrington };
  // fallback
  return { method: "Analysis", payload: null };
}

function decideDirectionLabel(direction) {
  const dir = String(direction || "").toLowerCase();
  if (dir === "high") return { ar: "ارتفاع", en: "elevation" };
  if (dir === "low") return { ar: "انخفاض", en: "decrease" };
  return { ar: "تغير", en: "change" };
}

function decideCaseLabel(direction) {
  const dir = String(direction || "").toLowerCase();
  if (dir === "high") return { ar: "حالات مرتفعة/غير طبيعية", en: "high/abnormal cases" };
  if (dir === "low") return { ar: "حالات منخفضة/غير طبيعية", en: "low/abnormal cases" };
  return { ar: "حالات غير اعتيادية", en: "unusual cases" };
}

function computeConfidence({ nTotal, weeks, baselineWeeksUsed, dataQuality = {} }) {
  // Conservative, explainable rules:
  // - Needs enough weeks + baseline + sample size
  // - Downgrade if flags indicate issues
  const smallN = nTotal != null && nTotal < 800; // across the timeRange (example)
  const shortSeries = weeks != null && weeks < 8;
  const weakBaseline = baselineWeeksUsed != null && baselineWeeksUsed < 6;

  const hasMissingAge = (dataQuality?.missingAgeRate ?? 0) >= 0.2;
  const hasMissingSex = (dataQuality?.missingSexRate ?? 0) >= 0.2;

  // Start from high and degrade
  let level = "high";
  if (smallN || shortSeries || weakBaseline || hasMissingAge || hasMissingSex) level = "medium";
  if ((smallN && shortSeries) || (hasMissingAge && hasMissingSex) || (weeks != null && weeks < 6)) level = "low";

  const map = {
    high: { ar: "ثقة عالية", en: "High confidence" },
    medium: { ar: "ثقة متوسطة", en: "Moderate confidence" },
    low: { ar: "ثقة منخفضة", en: "Low confidence" },
  };
  return map[level] || map.medium;
}

function buildDataLimitations({ nTotal, weeks, dataQuality = {}, notes = [] }) {
  const out = [];

  if (nTotal == null || nTotal === 0 || (weeks != null && weeks === 0)) {
    out.push({
      ar: "لا تتوفر بيانات كافية لإنتاج ملخص سردي موثوق للمعايير المختارة.",
      en: "Insufficient data to generate a reliable narrative summary for the selected parameters.",
    });
    return out;
  }

  // Small sample warning (weekly is better, but we only know totals here)
  if (nTotal < 800) {
    out.push({
      ar: `قد تتأثر الإشارات بالتذبذب الطبيعي بسبب حجم بيانات محدود نسبيًا (إجمالي الفحوصات: ${nTotal}).`,
      en: `Signals may be influenced by natural variation due to relatively limited data volume (total tests: ${nTotal}).`,
    });
  }

  if (weeks != null && weeks < 8) {
    out.push({
      ar: `التغطية الزمنية قصيرة نسبيًا (${weeks} أسابيع)، ما قد يقلل استقرار خط الأساس.`,
      en: `Time coverage is relatively short (${weeks} weeks), which may reduce baseline stability.`,
    });
  }

  const missAge = Number(dataQuality?.missingAgeRate);
  if (Number.isFinite(missAge) && missAge >= 0.1) {
    out.push({
      ar: `نسبة غير قليلة من السجلات تفتقد العمر (${pct(missAge)}%)، وقد يؤثر ذلك على دقة العتبات المعتمدة على العمر.`,
      en: `A non-trivial proportion of records is missing age (${pct(missAge)}%), which may affect age-dependent thresholds.`,
    });
  }

  const missSex = Number(dataQuality?.missingSexRate);
  if (Number.isFinite(missSex) && missSex >= 0.1) {
    out.push({
      ar: `نسبة غير قليلة من السجلات تفتقد الجنس (${pct(missSex)}%)، وقد يؤثر ذلك على دقة العتبات المعتمدة على الجنس.`,
      en: `A non-trivial proportion of records is missing sex (${pct(missSex)}%), which may affect sex-dependent thresholds.`,
    });
  }

  // Additional notes passed by caller (already bilingual or plain strings)
  for (const n of safeArr(notes)) {
    if (!n) continue;
    if (typeof n === "string") {
      out.push({ ar: n, en: n });
    } else {
      out.push({
        ar: n.ar || n.en || "",
        en: n.en || n.ar || "",
      });
    }
  }

  if (!out.length) {
    out.push({
      ar: "لا توجد قيود رئيسية مرصودة ضمن جودة البيانات للفترة المحددة.",
      en: "No major data quality limitations were observed for the selected period.",
    });
  }

  return out;
}

function buildRecommendedActions({ alert, method, direction, scopeLabel }) {
  const dir = decideDirectionLabel(direction);

  if (alert) {
    // Alert path: never “routine”
    return [
      {
        ar:
          `يوجد إنذار إحصائي بواسطة ${method} يشير إلى ${dir.ar} غير اعتيادي على مستوى السكان. ` +
          `يوصى بمراجعة جودة البيانات أولًا (اكتمال/تكرار/تواريخ)، ثم إجراء تحليل طبقي (العمر/الجنس) ` +
          `وتحديد المرفق/المنطقة الأعلى مساهمة ضمن نطاق التحليل (${scopeLabel}).`,
        en:
          `A statistical alert detected by ${method} indicates an unusual population-level ${dir.en}. ` +
          `First verify data quality (completeness/duplicates/dates), then run stratified analysis (age/sex) ` +
          `and identify the highest-contributing facility/region within the selected scope (${scopeLabel}).`,
      },
      {
        ar:
          "تنبيه: هذه إشارة ترصد سكاني لدعم القرار وليست تشخيصًا فرديًا. يجب تفسير الإنذار ضمن السياق الزمني والتشغيلي.",
        en:
          "Note: This is a population-level decision-support signal, not an individual diagnosis. Interpret the alert within operational and temporal context.",
      },
    ];
  }

  // No alert path
  return [
    {
      ar:
        `لا يوجد إنذار إحصائي حاليًا وفق ${method}. يوصى بالاستمرار في المراقبة الدورية وتحسين جودة التسجيل والاكتمال.`,
      en:
        `No statistical alert is currently detected under ${method}. Continue routine monitoring and improve data completeness/quality.`,
    },
    {
      ar:
        "تنبيه: هذا الملخص لا يقدم تشخيصًا أو إرشادًا علاجيًا، بل مؤشرات ترصد سكاني لدعم القرار.",
      en:
        "Note: This summary does not provide diagnosis or treatment guidance; it reports population-level surveillance indicators for decision support.",
    },
  ];
}

function buildExecutiveSummary({ alert, method, testCode, direction, latest, baselineWeeksUsed }) {
  const dir = decideDirectionLabel(direction);
  const tc = upper(testCode || "TEST");

  if (!latest) {
    return {
      ar: `لا تتوفر بيانات كافية لإنتاج ملخص سردي للفحص ${tc}.`,
      en: `Insufficient data to generate a narrative summary for ${tc}.`,
    };
  }

  if (alert) {
    return {
      ar:
        `تُظهر البيانات المجمعة أسبوعيًا إنذارًا إحصائيًا (${method}) يشير إلى ${dir.ar} مستمر/ملحوظ في الإشارة السكانية المرتبطة بالفحص ${tc} ` +
        `مقارنةً بخط الأساس (أسابيع الخط الأساس المستخدمة: ${baselineWeeksUsed}).`,
      en:
        `Weekly aggregated data show a statistical alert (${method}) indicating a sustained/meaningful ${dir.en} in the population signal for ${tc} ` +
        `compared with the established baseline (baseline weeks used: ${baselineWeeksUsed}).`,
    };
  }

  return {
    ar:
      `لا تظهر البيانات المجمعة أسبوعيًا إنذارًا إحصائيًا (${method}) للفحص ${tc} مقارنةً بخط الأساس (أسابيع الخط الأساس المستخدمة: ${baselineWeeksUsed}).`,
    en:
      `Weekly aggregated data do not show a statistical alert (${method}) for ${tc} compared with the baseline (baseline weeks used: ${baselineWeeksUsed}).`,
  };
}

function buildKeyObservations({ method, payload, direction }) {
  const pts = safeArr(payload?.points);
  const last = latestPoint(pts);
  const tc = upper(payload?.testCode || "TEST");
  const dir = decideDirectionLabel(direction);

  if (!pts.length) {
    return [
      { ar: `لا توجد نقاط زمنية كافية لاستخلاص ملاحظات للفحص ${tc}.`, en: `Not enough time points to extract observations for ${tc}.` },
    ];
  }

  // Basic observations: weeks, totals, latest status
  const w = weeksCount(pts);
  const nTotal = sum(pts, "n");

  // cases depend on direction
  const casesKey = String(direction || "").toLowerCase() === "high" ? "high" : "low";
  const rateKey = String(direction || "").toLowerCase() === "high" ? "highRate" : "lowRate";

  const casesTotal = sum(pts, casesKey);
  const latestRate = clampNum(last?.[rateKey], 4);
  const latestN = last?.n ?? 0;

  const obs = [];
  obs.push({
    ar: `الفحص: ${tc} — الطريقة: ${method} — الاتجاه: ${dir.ar}.`,
    en: `Test: ${tc} — method: ${method} — direction: ${dir.en}.`,
  });
  obs.push({
    ar: `التغطية الزمنية: ${w} أسابيع. إجمالي الفحوصات: ${nTotal}.`,
    en: `Time coverage: ${w} weeks. Total tests: ${nTotal}.`,
  });

  obs.push({
    ar: `آخر أسبوع (${last.week}): عدد الفحوصات ${latestN}، المعدل ${latestRate != null ? latestRate : "غير متاح"}.`,
    en: `Latest week (${last.week}): n=${latestN}, rate=${latestRate != null ? latestRate : "N/A"}.`,
  });

  // Add alert count if available
  const aCount = countAlerts(pts);
  obs.push({
    ar: aCount ? `عدد الأسابيع التي تحمل إنذارًا: ${aCount}.` : `لا توجد أسابيع تحمل إنذارًا ضمن الفترة.`,
    en: aCount ? `Alert weeks count: ${aCount}.` : `No alert weeks detected in the period.`,
  });

  // Cases total (optional, but useful)
  obs.push({
    ar: `ملخص الحالات: ${casesTotal} ${decideCaseLabel(direction).ar} عبر الفترة.`,
    en: `Cases summary: ${casesTotal} ${decideCaseLabel(direction).en} across the period.`,
  });

  return obs;
}

function buildAnalyticalContext({ method, payload, meta = {} }) {
  const tc = upper(payload?.testCode || meta.testCode || "TEST");
  const baselineWeeksUsed = payload?.baselineWeeksUsed ?? null;

  const facility = meta?.facilityId ? `Facility: ${meta.facilityId}` : null;
  const region = meta?.regionId ? `Region: ${meta.regionId}` : null;

  const scopeEn = facility || region || "Scope: All data";
  const scopeAr = meta?.facilityId
    ? `النطاق: مرفق (${meta.facilityId})`
    : meta?.regionId
    ? `النطاق: منطقة (${meta.regionId})`
    : "النطاق: جميع البيانات";

  const timeRange = meta?.timeRangeLabel || null;

  return {
    ar:
      `السياق التحليلي: تم تجميع البيانات أسبوعيًا للفحص ${tc}. ` +
      `المنهج المستخدم: ${method}. ` +
      (baselineWeeksUsed != null ? `خط الأساس: أول ${baselineWeeksUsed} أسابيع ضمن السلسلة.` : `خط الأساس: غير محدد.`) +
      (timeRange ? ` الفترة: ${timeRange}. ` : " ") +
      `${scopeAr}.`,
    en:
      `Analytical context: Data were aggregated weekly for ${tc}. ` +
      `Method used: ${method}. ` +
      (baselineWeeksUsed != null ? `Baseline: first ${baselineWeeksUsed} weeks in the series.` : `Baseline: not specified.`) +
      (timeRange ? ` Period: ${timeRange}. ` : " ") +
      `${scopeEn}.`,
  };
}

function formatReportText({ header, exec, observations, context, limitations, actions, closing }) {
  // Produces the on-screen narrative block style (paragraphs, not decorative)
  const join = (arr) => safeArr(arr).filter(Boolean).join("\n");

  const ar = join([
    "التقرير السردي",
    "",
    header?.ar,
    "",
    exec?.ar,
    "",
    "ملاحظات رئيسية:",
    ...safeArr(observations).map((o) => `- ${o.ar}`),
    "",
    context?.ar,
    "",
    "ملاحظات جودة البيانات:",
    ...safeArr(limitations).map((l) => `- ${l.ar}`),
    "",
    "الإجراء المقترح:",
    ...safeArr(actions).map((a) => `- ${a.ar}`),
    "",
    closing?.ar,
  ]);

  const en = join([
    "Narrative Report",
    "",
    header?.en,
    "",
    exec?.en,
    "",
    "Key observations:",
    ...safeArr(observations).map((o) => `- ${o.en}`),
    "",
    context?.en,
    "",
    "Data limitations & notes:",
    ...safeArr(limitations).map((l) => `- ${l.en}`),
    "",
    "Recommended action:",
    ...safeArr(actions).map((a) => `- ${a.en}`),
    "",
    closing?.en,
  ]);

  return { ar, en };
}

/**
 * Main builder
 *
 * @param {object} params
 * @param {object} params.analysis - analysis payload from analytics service (cusum/ewma/farrington)
 * @param {object} params.meta - { facilityId, regionId, scopeLabel, timeRangeLabel, testCode, signalType }
 * @param {object} params.dataQuality - optional { missingAgeRate, missingSexRate }
 * @param {array}  params.notes - optional extra notes (bilingual or strings)
 * @param {string} params.lang - "ar" | "en" | "both"
 */
function buildNarrativeReport({ analysis, meta = {}, dataQuality = {}, notes = [], lang = "both" }) {
  const now = dayjs().toISOString();

  const { method, payload } = pickMethodPayload(analysis || {});
  const points = safeArr(payload?.points);

  // Determine status from latest point (master rule)
  const last = latestPoint(points);
  const alert = Boolean(last?.alert);

  const testCode = upper(payload?.testCode || meta.testCode || "TEST");
  const direction = payload?.direction || meta.direction || null;

  const baselineWeeksUsed = payload?.baselineWeeksUsed ?? 0;
  const weeks = weeksCount(points);
  const nTotal = sum(points, "n");

  const confidence = computeConfidence({ nTotal, weeks, baselineWeeksUsed, dataQuality });

  const header = {
    ar:
      `تقرير سردي من نظام PULSE للمراقبة الصحية\n` +
      `المنشأة: ${meta.scopeLabel || "GLOBAL"}\n` +
      `الفحص: ${testCode}\n` +
      `الطريقة المستخدمة: ${method}\n` +
      `تاريخ الإنشاء: ${now}`,
    en:
      `PULSE population surveillance narrative\n` +
      `Scope: ${meta.scopeLabel || "GLOBAL"}\n` +
      `Test: ${testCode}\n` +
      `Method: ${method}\n` +
      `Generated: ${now}`,
  };

  const exec = buildExecutiveSummary({
    alert,
    method,
    testCode,
    direction,
    latest: last,
    baselineWeeksUsed,
  });

  const observations = buildKeyObservations({ method, payload, direction });

  const context = buildAnalyticalContext({ method, payload, meta });

  const limitations = buildDataLimitations({ nTotal, weeks, dataQuality, notes });

  const actions = buildRecommendedActions({
    alert,
    method,
    direction,
    scopeLabel: meta.scopeLabel || "GLOBAL",
  });

  const closing = {
    ar:
      `مستوى الثقة: ${confidence.ar}.\n` +
      `تنبيه: هذا التقرير يقدم مؤشرات ترصد على مستوى السكان لدعم القرار، ولا يُعد تشخيصًا فرديًا.`,
    en:
      `Confidence: ${confidence.en}.\n` +
      `Note: This report provides population-level decision-support indicators and is not an individual diagnosis.`,
  };

  const text = formatReportText({
    header,
    exec,
    observations,
    context,
    limitations,
    actions,
    closing,
  });

  const report = {
    meta: {
      generatedAt: now,
      method,
      testCode,
      scopeLabel: meta.scopeLabel || "GLOBAL",
      timeRangeLabel: meta.timeRangeLabel || null,
      status: alert ? "ALERT" : "NORMAL",
      confidence: confidence.en, // keep an EN key too
      confidenceLabel: confidence,
      baselineWeeksUsed,
      weeks,
      nTotal,
    },
    sections: {
      header,
      executiveSummary: exec,
      keyObservations: observations,
      analyticalContext: context,
      dataLimitations: limitations,
      recommendedAction: actions,
      closingStatement: closing,
    },
    text,
  };

  if (lang === "ar") return { report, narrative: text.ar };
  if (lang === "en") return { report, narrative: text.en };
  return { report, narrative: { ar: text.ar, en: text.en } };
}

module.exports = { buildNarrativeReport };
