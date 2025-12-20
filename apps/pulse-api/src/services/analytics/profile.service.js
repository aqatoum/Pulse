const { getSignal } = require("./signalRegistry");

// ===== Helpers =====

function anemiaThresholdHb(ageYears, sex) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  const s = String(sex || "U").toUpperCase();

  if (age !== null && age >= 5 && age <= 14) return 11.5;

  if (age !== null && age >= 15) {
    if (s === "F") return 12.0;
    if (s === "M") return 13.0;
    return 11.5;
  }

  return 11.0;
}

function ageBand(ageYears) {
  const age = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  if (age === null) return "unknown";
  if (age < 5) return "0-4";
  if (age <= 14) return "5-14";
  if (age <= 49) return "15-49";
  return "50+";
}

function sexNorm(sex) {
  const s = String(sex || "U").toUpperCase();
  if (s === "M" || s === "F") return s;
  return "U";
}

function round4(x) {
  return typeof x === "number" && Number.isFinite(x) ? Number(x.toFixed(4)) : null;
}

function normalizeLang(lang) {
  const l = String(lang || "both").toLowerCase();
  if (l === "ar" || l === "en" || l === "both") return l;
  return "both";
}

function toHbValue(r) {
  if (!r) return null;

  // only HB rows if testCode present
  const code = String(r.testCode || "").toUpperCase();
  if (code && code !== "HB" && code !== "HGB") return null;

  const v =
    (typeof r.value === "number" ? r.value : null) ??
    (typeof r.hb === "number" ? r.hb : null);

  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildInsight({ signalType, overall, byAge, bySex, byAgeSex, language = "en" }) {
  const sig = getSignal(signalType);

  const labelSignal =
    language === "ar"
      ? (sig?.description?.ar || "إشارة صحية")
      : (sig?.description?.en || "health signal");

  const totalN = overall?.n ?? 0;
  const totalLow = overall?.low ?? 0;
  const totalRate = overall?.lowRate ?? null;

  const MIN_N = 10;

  const candidates = (byAgeSex || [])
    .filter(g => (g.n ?? 0) >= MIN_N && typeof g.lowRate === "number")
    .sort((a, b) => (b.lowRate - a.lowRate));

  const top = candidates.length ? candidates[0] : null;

  const confidence =
    totalN >= 200
      ? { level: "high", ar: "ثقة عالية", en: "High confidence" }
      : totalN >= 80
      ? { level: "medium", ar: "ثقة متوسطة", en: "Moderate confidence" }
      : { level: "low", ar: "ثقة منخفضة", en: "Low confidence" };

  if (language === "ar") {
    const topText = top
      ? `أعلى نسبة كانت لدى (العمر ${top.ageBand}, الجنس ${top.sex}) بمعدل ${Math.round(
          top.lowRate * 100
        )}% من أصل ${top.n} فحص.`
      : "لا توجد عينة كافية لاستخلاص مقارنة قوية بين الفئات (نحتاج عينات أكبر لكل فئة).";

    return {
      title: "تحليل الفئات الأكثر تأثرًا",
      summary: `ملخص ${labelSignal}: تم تحليل ${totalN} فحصًا، وبلغ عدد الحالات منخفضة Hb ${totalLow} (معدل إجمالي ${
        totalRate !== null ? Math.round(totalRate * 100) : "غير متاح"
      }%).`,
      keyFinding: topText,
      confidenceLevel: confidence.level,
      confidenceLabel: confidence.ar,
      suggestedActions: [
        "استخدم هذا التحليل لتوجيه التدخلات (توعية/تغذية/متابعة) للفئات الأكثر تأثرًا.",
        "تحقق من جودة البيانات (العمر/الجنس/تاريخ الفحص) لأن أي نقص فيها يقلل دقة الاستنتاج.",
      ],
      disclaimer:
        "هذا تحليل سكاني لدعم القرار ولا يُعد تشخيصًا فرديًا. تفسير النتائج يجب أن يتم بالتنسيق مع الجهات الصحية المختصة.",
    };
  }

  const topText = top
    ? `Highest rate observed in (age ${top.ageBand}, sex ${top.sex}) at ${Math.round(
        top.lowRate * 100
      )}% based on ${top.n} tests.`
    : "No subgroup has sufficient sample size to support a strong comparison yet (larger samples per subgroup are needed).";

  return {
    title: "Most Affected Subgroup Analysis",
    summary: `Summary for ${labelSignal}: ${totalN} tests analyzed; ${totalLow} low-Hb cases (overall rate ${
      totalRate !== null ? Math.round(totalRate * 100) : "N/A"
    }%).`,
    keyFinding: topText,
    confidenceLevel: confidence.level,
    confidenceLabel: confidence.en,
    suggestedActions: [
      "Use this profiling to target interventions (nutrition/education/follow-up) toward the most affected subgroups.",
      "Review data completeness (age/sex/test date) because missingness reduces interpretability.",
    ],
    disclaimer:
      "This is a population-level decision-support analysis and not an individual diagnosis. Interpret findings with public health stakeholders.",
  };
}

function summarizeGroups(map, groupKeys) {
  const arr = [];
  for (const [key, v] of map.entries()) {
    const lowRate = v.n > 0 ? v.low / v.n : null;
    const obj = { ...groupKeys(key), n: v.n, low: v.low, lowRate: round4(lowRate) };
    arr.push(obj);
  }
  const ageOrder = { "0-4": 1, "5-14": 2, "15-49": 3, "50+": 4, unknown: 99 };
  arr.sort((a, b) => {
    const ao = ageOrder[a.ageBand ?? "unknown"] ?? 99;
    const bo = ageOrder[b.ageBand ?? "unknown"] ?? 99;
    if (ao !== bo) return ao - bo;
    const as = String(a.sex || "");
    const bs = String(b.sex || "");
    return as.localeCompare(bs);
  });
  return arr;
}

// ===== Main Service =====
function computeAnemiaProfile({ rows, lang = "both" }) {
  const language = normalizeLang(lang);

  let totalN = 0;
  let totalLow = 0;

  const byAge = new Map();     // key: ageBand
  const bySex = new Map();     // key: sex
  const byAgeSex = new Map();  // key: `${ageBand}|${sex}`

  for (const r of rows || []) {
    const hb = toHbValue(r);
    if (hb === null) continue;

    totalN++;

    const a = ageBand(r.ageYears);
    const s = sexNorm(r.sex);

    const thr = anemiaThresholdHb(r.ageYears, r.sex);
    const isLow = hb < thr;

    if (isLow) totalLow++;

    if (!byAge.has(a)) byAge.set(a, { n: 0, low: 0 });
    const ba = byAge.get(a);
    ba.n++;
    if (isLow) ba.low++;

    if (!bySex.has(s)) bySex.set(s, { n: 0, low: 0 });
    const bs = bySex.get(s);
    bs.n++;
    if (isLow) bs.low++;

    const k = `${a}|${s}`;
    if (!byAgeSex.has(k)) byAgeSex.set(k, { n: 0, low: 0 });
    const bas = byAgeSex.get(k);
    bas.n++;
    if (isLow) bas.low++;
  }

  const overall = {
    n: totalN,
    low: totalLow,
    lowRate: round4(totalN > 0 ? totalLow / totalN : null),
  };

  const profile = {
    overall,
    byAge: summarizeGroups(byAge, key => ({ ageBand: key })),
    bySex: summarizeGroups(bySex, key => ({ sex: key })),
    byAgeSex: summarizeGroups(byAgeSex, key => {
      const [ageBandKey, sexKey] = String(key).split("|");
      return { ageBand: ageBandKey, sex: sexKey };
    }),
  };

  const insight =
    language === "both"
      ? {
          ar: buildInsight({ signalType: "anemia", ...profile, language: "ar" }),
          en: buildInsight({ signalType: "anemia", ...profile, language: "en" }),
        }
      : buildInsight({ signalType: "anemia", ...profile, language });

  return { profile, insight };
}

module.exports = { computeAnemiaProfile };
