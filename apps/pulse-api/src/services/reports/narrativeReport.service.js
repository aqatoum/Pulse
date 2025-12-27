// apps/pulse-api/src/services/reports/narrativeReport.service.js

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pct(x, digits = 1) {
  const n = safeNum(x);
  if (n === null) return null;
  return Math.round(n * 100 * Math.pow(10, digits)) / Math.pow(10, digits);
}

function fmtPct(lang, x) {
  const p = pct(x, 1);
  if (p === null) return lang === "en" ? "N/A" : "غير متاح";
  return lang === "en" ? `${p}%` : `${p}%`;
}

function t(lang, key) {
  const AR = {
    header: "تقرير سردي — نظام PULSE للمراقبة الصحية",
    execTitle: "الملخص التنفيذي",
    obsTitle: "ملاحظات أساسية",
    ctxTitle: "السياق التحليلي",
    limTitle: "ملاحظات وحدود البيانات",
    closeTitle: "خاتمة",
    insufficient: "لا تتوفر بيانات كافية لإنشاء ملخص سردي للمعايير المختارة.",
    nonDiag:
      "هذا التقرير يقدم مؤشرات تحليلية على مستوى السكان ولا يُعد تشخيصًا فرديًا أو توصية علاجية. يجب تفسير النتائج ضمن السياق وبمراجعة المختصين.",
    stable: "ضمن النطاق المتوقع.",
    attention: "أعلى من خط الأساس المتوقع.",
    alert: "تم رصد انحراف مستمر.",
    trendUp: "اتجاه صاعد",
    trendDown: "اتجاه هابط",
    trendFlat: "اتجاه مستقر",
    confidenceHigh: "ثقة عالية",
    confidenceMed: "ثقة متوسطة",
    confidenceLow: "ثقة منخفضة",
    methodsUsed: "الطرق المستخدمة",
    baseline: "خط الأساس",
    agg: "مستوى التجميع",
    weekly: "أسبوعي",
  };

  const EN = {
    header: "Narrative Report — PULSE Health Surveillance",
    execTitle: "Executive summary",
    obsTitle: "Key observations",
    ctxTitle: "Analytical context",
    limTitle: "Data limitations & notes",
    closeTitle: "Closing statement",
    insufficient: "Insufficient data to generate a narrative summary for the selected parameters.",
    nonDiag:
      "This report provides population-level analytical indicators and does not constitute individual diagnosis or treatment guidance. Interpret findings within context and with expert review.",
    stable: "Within expected range.",
    attention: "Above expected baseline.",
    alert: "Sustained deviation detected.",
    trendUp: "Upward trend",
    trendDown: "Downward trend",
    trendFlat: "Stable trend",
    confidenceHigh: "High confidence",
    confidenceMed: "Moderate confidence",
    confidenceLow: "Low confidence",
    methodsUsed: "Methods used",
    baseline: "Baseline",
    agg: "Aggregation level",
    weekly: "Weekly",
  };

  return (lang === "en" ? EN : AR)[key] || key;
}

function pickTrendLabel(lang, trend) {
  const v = String(trend || "").toLowerCase();
  if (v.includes("up")) return t(lang, "trendUp");
  if (v.includes("down")) return t(lang, "trendDown");
  return t(lang, "trendFlat");
}

function pickConfidenceLabel(lang, conf) {
  const v = String(conf || "").toLowerCase();
  if (v.includes("high")) return t(lang, "confidenceHigh");
  if (v.includes("med")) return t(lang, "confidenceMed");
  return t(lang, "confidenceLow");
}

/**
 * ✅ قاعدة ذهبية:
 * buildNarrativeReport لا يحسب EWMA/CUSUM/Farrington
 * بل يستخدم مخرجات bundle القادمة من consensus/interpretation.
 */
function buildNarrativeReport({ lang = "ar", bundle }) {
  const safeLang = lang === "en" ? "en" : "ar";

  // Empty report rule (ممنوع تقرير فاضي)
  if (!bundle || !bundle.profile || !bundle.profile.overall) {
    return {
      header: t(safeLang, "header"),
      sections: [
        { title: t(safeLang, "execTitle"), text: t(safeLang, "insufficient") },
        { title: t(safeLang, "closeTitle"), text: t(safeLang, "nonDiag") },
      ],
    };
  }

  const status = String(bundle.status || "stable").toLowerCase(); // stable|attention|alert
  const statusLine =
    status === "alert"
      ? t(safeLang, "alert")
      : status === "attention"
      ? t(safeLang, "attention")
      : t(safeLang, "stable");

  const confLine = pickConfidenceLabel(safeLang, bundle.confidence || "medium");
  const trendLine = pickTrendLabel(safeLang, bundle.trend || "flat");

  const overall = bundle.profile.overall || {};
  const n = safeNum(overall.n);
  const low = safeNum(overall.low);
  const lowRate = overall.lowRate;

  // من السلاسل: نأخذ “أحدث أسبوع” لنكتب كلامًا متوافقًا مع الرسم
  const series = bundle.series || {};
  const ewma = series.ewma || null;
  const cusum = series.cusum || null;
  const farrington = series.farrington || null;

  const lastPoint = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);

  const ewmaLast = ewma ? lastPoint(ewma.points) : null;
  const cusumLast = cusum ? lastPoint(cusum.points) : null;
  const farrLast = farrington ? lastPoint(farrington.points) : null;

  // طريقة آمنة لاستخراج أحدث أسبوع + إشارة alert من نفس بيانات الرسم
  const lastWeek =
    (ewmaLast && ewmaLast.week) ||
    (cusumLast && cusumLast.week) ||
    (farrLast && farrLast.week) ||
    null;

  // ملاحظة: لا “نستنتج” alert هنا، نستخدم ما رجع من الخدمات
  const ewmaAlert = ewmaLast ? Boolean(ewmaLast.alert) : false;
  const cusumAlert = cusumLast ? Boolean(cusumLast.alert) : false;
  const farrAlert = farrLast ? Boolean(farrLast.alert) : false;

  const methodsUsed = [];
  if (ewma) methodsUsed.push("EWMA");
  if (cusum) methodsUsed.push("CUSUM");
  if (farrington) methodsUsed.push("Farrington");

  // Executive summary: لازم يطابق status و lowRate (كما في اللوحة)
  const execParts = [];
  execParts.push(statusLine);

  // صياغة محايدة تربط مباشرة بالرقم
  if (n !== null && low !== null) {
    if (safeLang === "en") {
      execParts.push(
        `Overall: ${low} out of ${n} records flagged (rate: ${fmtPct(safeLang, lowRate)}).`
      );
    } else {
      execParts.push(`الإجمالي: ${low} من أصل ${n} سجلًا ضمن الإشارة (المعدل: ${fmtPct(safeLang, lowRate)}).`);
    }
  }

  if (lastWeek) {
    execParts.push(safeLang === "en" ? `Latest week: ${lastWeek}.` : `أحدث أسبوع: ${lastWeek}.`);
  }

  execParts.push(`${trendLine} — ${confLine}.`);

  // Key observations: نقاط مدعومة فقط بما لدينا
  const obs = [];
  obs.push(
    safeLang === "en"
      ? `Status is based on model concordance (EWMA/CUSUM/Farrington) without diagnosis.`
      : `الحالة مبنية على توافق مخرجات النماذج (EWMA/CUSUM/Farrington) دون تشخيص.`
  );

  if (ewma) {
    const z = ewmaLast ? safeNum(ewmaLast.z) : null;
    const UCL = safeNum(ewma.UCL);
    obs.push(
      safeLang === "en"
        ? `EWMA: latest z=${z ?? "N/A"} vs UCL=${UCL ?? "N/A"} (alert=${ewmaAlert}).`
        : `EWMA: آخر قيمة z=${z ?? "غير متاح"} مقابل UCL=${UCL ?? "غير متاح"} (إنذار=${ewmaAlert ? "نعم" : "لا"}).`
    );
  }

  if (cusum) {
    const s = cusumLast ? safeNum(cusumLast.score ?? cusumLast.s ?? cusumLast.value) : null;
    const h = safeNum(cusum.h ?? cusum.threshold);
    obs.push(
      safeLang === "en"
        ? `CUSUM: latest score=${s ?? "N/A"} vs threshold=${h ?? "N/A"} (alert=${cusumAlert}).`
        : `CUSUM: آخر قيمة=${s ?? "غير متاح"} مقابل العتبة=${h ?? "غير متاح"} (إنذار=${cusumAlert ? "نعم" : "لا"}).`
    );
  }

  if (farrington) {
    const obsV = farrLast ? safeNum(farrLast.observed ?? farrLast.value) : null;
    const thr = farrLast ? safeNum(farrLast.threshold ?? farrLast.upper) : null;
    obs.push(
      safeLang === "en"
        ? `Farrington: observed=${obsV ?? "N/A"} vs threshold=${thr ?? "N/A"} (alert=${farrAlert}).`
        : `Farrington: المرصود=${obsV ?? "غير متاح"} مقابل العتبة=${thr ?? "غير متاح"} (إنذار=${farrAlert ? "نعم" : "لا"}).`
    );
  }

  // Analytical context: baseline + aggregation
  const ctx = [];
  ctx.push(`${t(safeLang, "methodsUsed")}: ${methodsUsed.length ? methodsUsed.join(" + ") : "N/A"}`);
  ctx.push(`${t(safeLang, "agg")}: ${t(safeLang, "weekly")}`);

  if (ewma && safeNum(ewma.baselineMean) !== null) {
    ctx.push(
      safeLang === "en"
        ? `Baseline (EWMA): mean=${ewma.baselineMean}, std=${ewma.baselineStd ?? "N/A"}, weeksUsed=${ewma.baselineWeeksUsed ?? "N/A"}.`
        : `خط الأساس (EWMA): المتوسط=${ewma.baselineMean}، الانحراف=${ewma.baselineStd ?? "غير متاح"}، عدد الأسابيع=${ewma.baselineWeeksUsed ?? "غير متاح"}.`
    );
  }

  // Limitations & notes: من bundle.notes أو قواعد عامة (بدون تهويل)
  const notes = [];
  const bn = Array.isArray(bundle.notes) ? bundle.notes : [];
  bn.forEach((x) => {
    const s = String(x || "").trim();
    if (s) notes.push(s);
  });

  if (!notes.length) {
    notes.push(
      safeLang === "en"
        ? "Interpret results with caution when data volume is limited or when the selected window is short."
        : "يجب تفسير النتائج بحذر عند محدودية حجم البيانات أو قِصر النافذة الزمنية المختارة."
    );
  }

  // Closing: non-diagnostic
  const closing = t(safeLang, "nonDiag");

  return {
    header: t(safeLang, "header"),
    status: status,
    sections: [
      { title: t(safeLang, "execTitle"), text: execParts.join(" ") },
      { title: t(safeLang, "obsTitle"), bullets: obs },
      { title: t(safeLang, "ctxTitle"), bullets: ctx },
      { title: t(safeLang, "limTitle"), bullets: notes },
      { title: t(safeLang, "closeTitle"), text: closing },
    ],
  };
}

module.exports = { buildNarrativeReport };
