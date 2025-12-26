function fmtDateRange(dr) {
  const s = dr?.filtered?.start || dr?.start || null;
  const e = dr?.filtered?.end || dr?.end || null;
  if (!s && !e) return { ar: "غير محدد", en: "Not specified" };
  if (s && e) return { ar: `(${s} إلى ${e})`, en: `(${s} to ${e})` };
  return { ar: `(${s || "?"} إلى ${e || "?"})`, en: `(${s || "?"} to ${e || "?"})` };
}

function scopeLabel(scope) {
  const type = String(scope?.scopeType || "GLOBAL").toUpperCase();
  if (type === "FACILITY") return { ar: "ضمن مرفق صحي", en: "Facility-level" };
  if (type === "REGION") return { ar: "ضمن منطقة", en: "Region-level" };
  if (type === "LAB") return { ar: "ضمن مختبر", en: "Laboratory-level" };
  return { ar: "وطني (على مستوى الدولة)", en: "National (country-wide)" }; // ✅ بدل GLOBAL/جلوبال
}

function decisionLabel(decision) {
  const d = String(decision || "info").toLowerCase();
  if (d === "alert") return { ar: "إنذار", en: "ALERT" };
  if (d === "watch") return { ar: "مراقبة", en: "WATCH" };
  return { ar: "طبيعي", en: "INFO" };
}

function confidenceFromDQ(dq) {
  const overallN = dq?.overallN ?? 0;
  const weeks = dq?.weeksCoverage ?? 0;
  if (overallN >= 200 && weeks >= 12) return { ar: "عالية", en: "High" };
  if (overallN >= 60 && weeks >= 6) return { ar: "متوسطة", en: "Moderate" };
  return { ar: "محدودة", en: "Limited" };
}

function methodsLabel(methods) {
  const m = Array.isArray(methods) ? methods : [];
  const up = m.map((x) => String(x).toUpperCase());
  return up.join(" + ");
}

function keyFinding(profileInsight, lang) {
  if (!profileInsight) return "";
  return lang === "ar"
    ? (profileInsight?.ar?.keyFinding || profileInsight?.ar?.summary || "")
    : (profileInsight?.en?.keyFinding || profileInsight?.en?.summary || "");
}

function safeNum(x) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function overallSummary(profile) {
  const n = profile?.overall?.n ?? 0;
  const rate = safeNum(profile?.overall?.rate);
  const cases = profile?.overall?.cases ?? null;
  return { n, rate, cases };
}

function fmtPct(rate) {
  const r = safeNum(rate);
  if (r === null) return "—";
  return `${(r * 100).toFixed(1)}%`;
}

function buildPublic({ lang, scope, analysis, dateRange, consensus, dataQuality, profile, profileInsight }) {
  const sc = scopeLabel(scope);
  const dr = fmtDateRange(dateRange);
  const dec = decisionLabel(consensus?.decision);
  const conf = confidenceFromDQ(dataQuality);
  const mLbl = methodsLabel(analysis?.methods);

  const { n, rate, cases } = overallSummary(profile);
  const kfAr = keyFinding(profileInsight, "ar");
  const kfEn = keyFinding(profileInsight, "en");

  const ar = [
    "نظرة تحليلية",
    `تم تنفيذ تحليل ترصد مبكر باستخدام بيانات مخبرية روتينية للفحص (${analysis?.testCode || "—"}) ضمن نطاق ${sc.ar} للفترة ${dr.ar}.`,
    "",
    "منهجية كشف الشذوذ",
    `تم استخدام إطار متعدد الطرق: ${mLbl}.`,
    "",
    "تفسير الإشارة",
    `قرار الإجماع: ${dec.ar}. الثقة: ${conf.ar}. معدل الإشارة: ${fmtPct(rate)} (Cases=${cases ?? "—"}, N=${n}).`,
    kfAr ? `مؤشر سكاني بارز: ${kfAr}` : "",
    "",
    "دلالات الصحة العامة",
    dec.ar === "إنذار"
      ? "يوصى بمراجعة عاجلة: تأكيد جودة البيانات، ثم تحديد المرفق/المنطقة/الفئة السكانية الأكثر مساهمة واتخاذ إجراء مناسب."
      : dec.ar === "مراقبة"
      ? "يوصى بالمتابعة القريبة خلال الأسابيع القادمة، مع توسيع حجم العينة لتحسين الثقة."
      : "لا يوجد إجراء عاجل. الاستمرار في الرصد وتحسين اكتمال البيانات وجودتها.",
  ]
    .filter(Boolean)
    .join("\n");

  const en = [
    "Analytical overview",
    `Early-warning surveillance analysis was performed using routine laboratory data for (${analysis?.testCode || "—"}) at ${sc.en} scope for ${dr.en}.`,
    "",
    "Anomaly detection approach",
    `A multi-method framework was applied: ${mLbl}.`,
    "",
    "Signal interpretation",
    `Consensus decision: ${dec.en}. Confidence: ${conf.en}. Signal rate: ${fmtPct(rate)} (Cases=${cases ?? "—"}, N=${n}).`,
    kfEn ? `Key population insight: ${kfEn}` : "",
    "",
    "Public health meaning",
    dec.en === "ALERT"
      ? "Immediate review is recommended: validate data quality, then identify the main contributing facility/region/subgroup and take appropriate action."
      : dec.en === "WATCH"
      ? "Close monitoring is recommended over the coming weeks; increase sample size to improve confidence."
      : "No urgent action. Continue monitoring and improve data completeness and quality.",
  ]
    .filter(Boolean)
    .join("\n");

  return { ar, en };
}

function buildTechnical({ lang, scope, analysis, dateRange, consensus, dataQuality, profile, results }) {
  const sc = scopeLabel(scope);
  const dr = fmtDateRange(dateRange);
  const dec = decisionLabel(consensus?.decision);
  const conf = confidenceFromDQ(dataQuality);
  const mLbl = methodsLabel(analysis?.methods);

  const n = profile?.overall?.n ?? 0;
  const rate = safeNum(profile?.overall?.rate);
  const cases = profile?.overall?.cases ?? null;

  const perMethod = consensus?.perMethod || {};
  const per = Object.entries(perMethod).map(([k, v]) => ({
    method: String(k).toUpperCase(),
    level: String(v?.alertLevel || "info").toUpperCase(),
    conf: String(v?.confidenceLevel || "low").toUpperCase(),
  }));

  const ewPts = results?.ewma?.points?.length ?? 0;
  const cuPts = results?.cusum?.points?.length ?? 0;
  const faPts = results?.farrington?.points?.length ?? 0;

  const ar = [
    "ملخص تقني لصنّاع القرار (Decision Brief)",
    `النطاق: ${sc.ar} • الفترة: ${dr.ar}`,
    `الفحص/المؤشر: ${analysis?.testCode || "—"} • الإشارة: ${analysis?.signalType || "—"}`,
    "",
    "1) خلاصة القرار",
    `Consensus: ${dec.ar} • Confidence: ${conf.ar}`,
    `Signal rate: ${fmtPct(rate)} (Cases=${cases ?? "—"}, N=${n})`,
    "",
    "2) المنهجية (Syndromic / Laboratory Signal Surveillance)",
    `Applied methods: ${mLbl}`,
    `Coverage (weeks): EWMA=${ewPts}, CUSUM=${cuPts}, Farrington=${faPts}`,
    "",
    "3) نتائج الطرق (per-method interpretation)",
    per.length
      ? per.map((x) => `- ${x.method}: Level=${x.level}, Confidence=${x.conf}`).join("\n")
      : "- لا تتوفر تفاصيل per-method.",
    "",
    "4) جودة البيانات (Data Quality / Fitness-for-use)",
    `Overall N=${n} • Weeks coverage=${dataQuality?.weeksCoverage ?? "—"} • Recent N=${dataQuality?.recentN ?? "—"}`,
    dataQuality?.smallN ? "- تحذير: حجم عينة صغير (قد يزيد الإيجابيات الكاذبة)." : "",
    dataQuality?.sparseSeries ? "- تحذير: سلسلة زمنية قصيرة/متقطعة (حساسية القرار أقل)." : "",
    "",
    "5) توصيات تشغيلية (Operational Recommendations)",
    dec.ar === "إنذار"
      ? [
          "- تحقق سريع من صحة البيانات (وحدات القياس، تكرار السجلات، التواريخ، مصادر الرفع).",
          "- تحليل المساهمات حسب: العمر/الجنس/الجنسية/المرفق/المنطقة (Attribution).",
          "- تفعيل مسار استجابة: إبلاغ الجهة الصحية المختصة + تدقيق سريري/مختبري عند الحاجة.",
        ].join("\n")
      : dec.ar === "مراقبة"
      ? [
          "- متابعة أسبوعية/نصف شهرية مع مقارنة النطاق (وطني/منطقة/مرفق).",
          "- رفع اكتمال البيانات وزيادة حجم العينة لتحسين موثوقية الكشف.",
        ].join("\n")
      : [
          "- الاستمرار في الترصد الروتيني.",
          "- تحسين جودة البيانات وتوحيد المدخلات (testCode/nationality/sex).",
        ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const en = [
    "Technical decision brief (for policymakers)",
    `Scope: ${sc.en} • Period: ${dr.en}`,
    `Test/indicator: ${analysis?.testCode || "—"} • Signal: ${analysis?.signalType || "—"}`,
    "",
    "1) Decision summary",
    `Consensus: ${dec.en} • Confidence: ${conf.en}`,
    `Signal rate: ${fmtPct(rate)} (Cases=${cases ?? "—"}, N=${n})`,
    "",
    "2) Methodology (laboratory signal surveillance)",
    `Applied methods: ${mLbl}`,
    `Temporal coverage (weeks): EWMA=${ewPts}, CUSUM=${cuPts}, Farrington=${faPts}`,
    "",
    "3) Per-method results",
    per.length
      ? per.map((x) => `- ${x.method}: Level=${x.level}, Confidence=${x.conf}`).join("\n")
      : "- Per-method details unavailable.",
    "",
    "4) Data quality (fitness-for-use)",
    `Overall N=${n} • Weeks coverage=${dataQuality?.weeksCoverage ?? "—"} • Recent N=${dataQuality?.recentN ?? "—"}`,
    dataQuality?.smallN ? "- Warning: low sample size (may increase false positives)." : "",
    dataQuality?.sparseSeries ? "- Warning: short/sparse time-series (lower inference strength)." : "",
    "",
    "5) Operational recommendations",
    dec.en === "ALERT"
      ? [
          "- Rapid data validation (units, duplicates, dates, upload sources).",
          "- Attribution analysis by age/sex/nationality/facility/region.",
          "- Activate response pathway: notify public health authority + clinical/lab review if needed.",
        ].join("\n")
      : dec.en === "WATCH"
      ? [
          "- Monitor weekly/biweekly and compare scopes (national/region/facility).",
          "- Increase completeness and sample size to improve detection reliability.",
        ].join("\n")
      : [
          "- Continue routine surveillance.",
          "- Improve data quality and standardize inputs (testCode/nationality/sex).",
        ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  return { ar, en };
}

function buildNarratives(payload) {
  const { lang } = payload || {};
  const pub = buildPublic(payload);
  const tech = buildTechnical(payload);

  // Return both languages always; caller can pick
  return { public: pub, technical: tech, lang: lang || "both" };
}

module.exports = { buildNarratives };
