// pulse-api/src/services/analytics/interpretation.service.js

function fmt(n, d = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Number(x.toFixed(d));
}

function pct(x, d = 1) {
  const v = Number(x);
  if (!Number.isFinite(v)) return null;
  return `${(v * 100).toFixed(d)}%`;
}

function upper(x) {
  return String(x || "").toUpperCase();
}

function lastOf(points = []) {
  if (!Array.isArray(points) || points.length === 0) return null;
  return points[points.length - 1];
}

function recentSlice(points = [], k = 12) {
  if (!Array.isArray(points)) return [];
  return points.slice(Math.max(0, points.length - k));
}

function classifyAlertLevel({ method, points }) {
  const p = lastOf(points);
  if (!p) return { alertLevel: "info", band: 0 };

  // Prefer explicit alert boolean if present
  const isAlert = !!p.alert;

  // Watch: near-threshold (if we have expected/UCL)
  const hasUcl = Number.isFinite(Number(p.UCL));
  const hasExpected = Number.isFinite(Number(p.expected));
  const val = Number.isFinite(Number(p.low)) ? Number(p.low) : Number(p.z);

  if (isAlert) return { alertLevel: "alert", band: 3 };

  if (hasUcl && Number.isFinite(val)) {
    const ratio = p.UCL > 0 ? val / p.UCL : 0;
    if (ratio >= 0.8) return { alertLevel: "watch", band: 2 };
  }

  // Otherwise stable/info
  return { alertLevel: "info", band: 0 };
}

function confidenceFromData(points = []) {
  const n = Array.isArray(points) ? points.length : 0;
  if (n >= 80) return { level: "high", label: { en: "High confidence", ar: "ثقة عالية" } };
  if (n >= 30) return { level: "medium", label: { en: "Moderate confidence", ar: "ثقة متوسطة" } };
  return { level: "low", label: { en: "Low confidence", ar: "ثقة منخفضة" } };
}

function bandLabel(band, lang) {
  const ar = ["مستقر", "انتباه", "مراقبة", "إنذار"];
  const en = ["Stable", "Attention", "Watch", "Alert"];
  return (lang === "ar" ? ar : en)[band] || (lang === "ar" ? "غير محدد" : "Unknown");
}

function buildFarringtonText({ language, signalType, method, points, meta }) {
  const lang = language === "ar" ? "ar" : "en";
  const last = lastOf(points);
  const recent = recentSlice(points, 12);

  const baselineWeeks = meta?.baselineWeeks ?? null;
  const z = meta?.z ?? null;

  const lastWeek = last?.week ?? null;
  const n = Number.isFinite(Number(last?.n)) ? Number(last.n) : null;
  const low = Number.isFinite(Number(last?.low)) ? Number(last.low) : null;
  const expected = Number.isFinite(Number(last?.expected)) ? Number(last.expected) : null;
  const UCL = Number.isFinite(Number(last?.UCL)) ? Number(last.UCL) : null;

  const lowRate = (n && low !== null) ? low / n : null;
  const exceed = (low !== null && UCL !== null) ? (low - UCL) : null;

  const alertsRecent = recent.filter(p => !!p.alert).length;
  const weeksRecent = recent.length;

  const cls = classifyAlertLevel({ method, points });
  const conf = confidenceFromData(points);

  const riskLabel = bandLabel(cls.band, lang);

  // ---------- Arabic ----------
  if (lang === "ar") {
    const title =
      cls.alertLevel === "alert"
        ? "إنذار شذوذ إحصائي: ارتفاع غير معتاد في حالات فقر الدم"
        : cls.alertLevel === "watch"
        ? "مراقبة: اقتراب المؤشر من حد الإنذار الإحصائي"
        : "استقرار: لا توجد إشارة تفشٍ غير معتادة حاليًا";

    const summaryLines = [
      `تم تحليل مؤشر فقر الدم على مستوى السكان باستخدام طريقة ${upper(method)} اعتمادًا على التجميع الأسبوعي لعدد الحالات المنخفضة Hb.`,
      baselineWeeks ? `المرجع (Baseline): آخر ${baselineWeeks} أسابيع مماثلة.` : null,
      Number.isFinite(Number(z)) ? `عتبة الشذوذ (z): ${fmt(z, 2)}.` : null,
      lastWeek ? `الأسبوع الجاري: ${lastWeek}.` : null,
      (n !== null && low !== null) ? `عدد الفحوصات: ${n} • الحالات المنخفضة: ${low} (${lowRate !== null ? pct(lowRate) : "—"}).` : null,
      (expected !== null && UCL !== null && low !== null)
        ? `المتوقع: ${fmt(expected, 2)} • الحد الأعلى (UCL): ${fmt(UCL, 2)} • الفارق عن الحد: ${fmt(exceed, 2)}.`
        : null,
      weeksRecent ? `آخر ${weeksRecent} أسبوعًا: رُصد ${alertsRecent} أسبوع/أسابيع بإنذار.` : null,
    ].filter(Boolean);

    const recommendedActions = [];
    if (cls.alertLevel === "alert") {
      recommendedActions.push(
        "تفعيل تحقق وبائي سريع: مراجعة جودة البيانات (ازدواجية/تواريخ/رموز) ثم تأكيد الارتفاع عبر مصادر إضافية إن أمكن.",
        "تقسيم التحليل حسب العمر/الجنس/الموقع داخل المنطقة لتحديد أين يتركز الارتفاع.",
        "مراجعة العوامل المحتملة: تغيرات التغطية المخبرية، انقطاع إمدادات الحديد، أو عوامل موسمية/غذائية."
      );
    } else if (cls.alertLevel === "watch") {
      recommendedActions.push(
        "تكثيف المراقبة للأسبوعين القادمين مع الحفاظ على نفس إعدادات الحساسية لضمان قابلية المقارنة.",
        "مراجعة حجم العينات الأسبوعي؛ انخفاض/ارتفاع n قد يؤثر على تفسير الإشارة."
      );
    } else {
      recommendedActions.push(
        "الاستمرار في المراقبة الأسبوعية الروتينية.",
        "التحقق دوريًا من اكتمال البيانات واتساق الرموز (facilityId / regionId / labId)."
      );
    }

    const narrative =
      summaryLines.join("\n") +
      "\n\n" +
      "ملاحظة منهجية:\n" +
      "طريقة Farrington تقارن عدد الحالات المرصودة أسبوعيًا بما هو متوقع من التاريخ القريب (Baseline)، وتطلق إنذارًا عندما يتجاوز المرصود حدًا إحصائيًا أعلى (UCL). هذا يهدف لاكتشاف الارتفاعات غير المعتادة مبكرًا على مستوى السكان.";

    return {
      signal: signalType,
      method,
      alertLevel: cls.alertLevel,
      riskBand: cls.band,
      riskLabel,
      confidenceLevel: conf.level,
      confidenceLabel: conf.label.ar,
      title,
      summary: summaryLines.slice(0, 3).join(" "),
      narrative,
      recommendedActions,
      disclaimer:
        "هذا التحليل آلي لدعم قرار الصحة العامة على مستوى السكان، ولا يُستخدم للتشخيص الفردي.",
      meta: {
        timeRange: meta?.timeRange ?? null,
        baselineWeeks,
        z,
        lastWeek,
        n,
        low,
        lowRate: lowRate !== null ? fmt(lowRate, 4) : null,
        expected: expected !== null ? fmt(expected, 2) : null,
        UCL: UCL !== null ? fmt(UCL, 2) : null,
        alertsInLast12: alertsRecent,
      },
    };
  }

  // ---------- English ----------
  const title =
    cls.alertLevel === "alert"
      ? "Statistical alert: unusual increase in low-Hb counts"
      : cls.alertLevel === "watch"
      ? "Watch: indicator approaching the statistical threshold"
      : "Stable: no unusual outbreak signal detected";

  const summaryLines = [
    `We analyzed a population-level anemia signal using the ${upper(method)} approach on weekly aggregated low-Hb counts.`,
    baselineWeeks ? `Baseline: the most recent ${baselineWeeks} comparable weeks.` : null,
    Number.isFinite(Number(z)) ? `Outlier threshold (z): ${fmt(z, 2)}.` : null,
    lastWeek ? `Current week: ${lastWeek}.` : null,
    (n !== null && low !== null) ? `Tests: ${n} • Low-Hb cases: ${low} (${lowRate !== null ? pct(lowRate) : "—"}).` : null,
    (expected !== null && UCL !== null && low !== null)
      ? `Expected: ${fmt(expected, 2)} • Upper limit (UCL): ${fmt(UCL, 2)} • Margin vs UCL: ${fmt(exceed, 2)}.`
      : null,
    weeksRecent ? `Last ${weeksRecent} weeks: ${alertsRecent} alert week(s) detected.` : null,
  ].filter(Boolean);

  const recommendedActions = [];
  if (cls.alertLevel === "alert") {
    recommendedActions.push(
      "Trigger rapid epidemiologic verification: validate data quality (duplicates, dates, coding), then corroborate the increase with additional sources if available.",
      "Stratify by age/sex and sub-locations to localize the signal.",
      "Review plausible drivers: testing coverage changes, supply/availability of iron supplements, or seasonal/nutritional patterns."
    );
  } else if (cls.alertLevel === "watch") {
    recommendedActions.push(
      "Increase monitoring frequency for the next 1–2 weeks while keeping sensitivity settings unchanged for comparability.",
      "Review weekly sample size (n), as volume shifts can affect interpretation."
    );
  } else {
    recommendedActions.push(
      "Continue routine weekly monitoring.",
      "Periodically verify data completeness and identifier consistency (facilityId / regionId / labId)."
    );
  }

  const narrative =
    summaryLines.join("\n") +
    "\n\n" +
    "Method note:\n" +
    "Farrington-style detection compares observed weekly counts to an expected baseline derived from recent history, and flags an alert when observations exceed an upper statistical limit (UCL). It is designed for early detection of unusual population-level increases.";

  return {
    signal: signalType,
    method,
    alertLevel: cls.alertLevel,
    riskBand: cls.band,
    riskLabel,
    confidenceLevel: conf.level,
    confidenceLabel: conf.label.en,
    title,
    summary: summaryLines.slice(0, 3).join(" "),
    narrative,
    recommendedActions,
    disclaimer:
      "This is an automated, population-level decision-support signal and is not intended for individual diagnosis.",
    meta: {
      timeRange: meta?.timeRange ?? null,
      baselineWeeks,
      z,
      lastWeek,
      n,
      low,
      lowRate: lowRate !== null ? fmt(lowRate, 4) : null,
      expected: expected !== null ? fmt(expected, 2) : null,
      UCL: UCL !== null ? fmt(UCL, 2) : null,
      alertsInLast12: alertsRecent,
    },
  };
}

/**
 * Main generator used across methods.
 * Keep it simple: route to method-specific builders when needed.
 */
function generateInterpretation({
  language = "en",
  signalType = "anemia",
  method = "UNKNOWN",
  points = [],
  // meta is flexible: can include baselineWeeks, z, timeRange, etc.
  baselineWeeks,
  z,
  timeRange,
} = {}) {
  const meta = { baselineWeeks, z, timeRange };
  const m = String(method || "").toUpperCase();

  if (m === "FARRINGTON") {
    return buildFarringtonText({
      language,
      signalType,
      method: m,
      points,
      meta,
    });
  }

  // Default fallback for other methods (kept brief)
  const lang = String(language || "en").toLowerCase() === "ar" ? "ar" : "en";
  const conf = confidenceFromData(points);
  const cls = classifyAlertLevel({ method: m, points });
  const riskLabel = bandLabel(cls.band, lang);

  if (lang === "ar") {
    return {
      signal: signalType,
      method: m,
      alertLevel: cls.alertLevel,
      riskBand: cls.band,
      riskLabel,
      confidenceLevel: conf.level,
      confidenceLabel: conf.label.ar,
      title: "ملخص تحليلي آلي للمؤشر",
      summary: `تم تطبيق ${m} على الإشارة. النتيجة الحالية: ${riskLabel}.`,
      narrative:
        `تم تطبيق ${m} على بيانات الأسبوعية لتقييم وجود تغير غير معتاد. النتيجة الحالية: ${riskLabel}.\n\nهذا نص افتراضي مختصر—يمكن تخصيصه لكل طريقة لاحقًا.`,
      recommendedActions: ["مراجعة جودة البيانات والمتابعة الدورية."],
      disclaimer:
        "هذا التحليل آلي لدعم قرار الصحة العامة على مستوى السكان، ولا يُستخدم للتشخيص الفردي.",
      meta,
    };
  }

  return {
    signal: signalType,
    method: m,
    alertLevel: cls.alertLevel,
    riskBand: cls.band,
    riskLabel,
    confidenceLevel: conf.level,
    confidenceLabel: conf.label.en,
    title: "Automated analytic summary",
    summary: `Method ${m} applied to the signal. Current status: ${riskLabel}.`,
    narrative:
      `We applied ${m} to the weekly series to assess whether the recent pattern is unusual. Current status: ${riskLabel}.\n\nThis is a brief default template and can be specialized per method.`,
    recommendedActions: ["Verify data quality and continue routine monitoring."],
    disclaimer:
      "This is an automated, population-level decision-support signal and is not intended for individual diagnosis.",
    meta,
  };
}

module.exports = { generateInterpretation };
