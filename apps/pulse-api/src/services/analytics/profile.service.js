const { getSignal } = require("./signalRegistry");
const CLINICAL = require("../../config/clinical.thresholds"); // ✅ NEW: age-based thresholds for non-Hb tests

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

function nationalityNorm(n) {
  const s = String(n || "").trim();
  return s ? s : "unknown";
}

function round4(x) {
  return typeof x === "number" && Number.isFinite(x) ? Number(x.toFixed(4)) : null;
}

function normalizeLang(lang) {
  const l = String(lang || "both").toLowerCase();
  if (l === "ar" || l === "en" || l === "both") return l;
  return "both";
}

// ===== Value extractors (generalized) =====

function normalizeTestCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * Universal numeric extractor for ANY test.
 * - If testCodeFilter is provided, we enforce it.
 * - Accepts r.value (number or numeric string).
 * - Falls back to anemia legacy r.hb for backward compatibility.
 */
function toNumericValue(r, testCodeFilter = null) {
  if (!r) return null;

  const code = normalizeTestCode(r.testCode || "");
  if (testCodeFilter) {
    const want = normalizeTestCode(testCodeFilter);
    if (code && code !== want) return null;
  }

  let v = null;

  if (typeof r.value === "number") v = r.value;
  else if (typeof r.value === "string") v = Number(r.value);

  // backward compatible anemia field
  if (!Number.isFinite(v) && typeof r.hb === "number") v = r.hb;

  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ✅ percent formatting helper (controls decimals)
function pct(rate01, decimals = 1) {
  if (typeof rate01 !== "number" || !Number.isFinite(rate01)) return null;
  const p = rate01 * 100;
  return Number(p.toFixed(decimals));
}

// ===== Age-band -> clinical thresholds =====

function pickBand(bands, ageYears) {
  const a = typeof ageYears === "number" && Number.isFinite(ageYears) ? ageYears : null;
  if (a === null) return null;
  return (bands || []).find((b) => a >= b.min && a <= b.max) || null;
}

/**
 * Build case definition (low/high) using:
 * - Hb anemia rule (sex/age) for signalType anemia
 * - CLINICAL config for other tests (age-based bands)
 */
function buildCaseDef({ signalType, testCode }) {
  const st = String(signalType || "").toLowerCase();
  const tc = normalizeTestCode(testCode || "");

  // Special: anemia (Hb)
  if (st === "anemia" || tc === "HB" || tc === "HGB") {
    return {
      direction: "low",
      isCase: (value, row) => {
        const thr = anemiaThresholdHb(row?.ageYears, row?.sex);
        return value < thr;
      },
    };
  }

  const cfg = CLINICAL?.[tc] || null;
  if (!cfg) return null;

  const direction = String(cfg.direction || "high").toLowerCase() === "low" ? "low" : "high";

  return {
    direction,
    isCase: (value, row) => {
      const band = pickBand(cfg.bands, row?.ageYears);
      if (!band) return false;

      if (direction === "high") {
        const upper = typeof band.upper === "number" ? band.upper : null;
        if (upper === null) return false;
        return value > upper;
      }

      const lower = typeof band.lower === "number" ? band.lower : null;
      if (lower === null) return false;
      return value < lower;
    },
  };
}

// ===== Insight builder (direction-aware) =====
function buildInsight({
  signalType,
  overall,
  byAgeSex,
  language = "en",
  direction = "low", // "low" | "high"
  caseLabelEn = "cases",
  caseLabelAr = "حالات",
}) {
  const sig = getSignal(signalType);

  const labelSignal =
    language === "ar"
      ? sig?.description?.ar || "إشارة صحية"
      : sig?.description?.en || "health signal";

  const totalN = overall?.n ?? 0;

  const countKey = direction === "high" ? "high" : "low";
  const rateKey = direction === "high" ? "highRate" : "lowRate";

  const totalCases = overall?.[countKey] ?? 0;
  const totalRate = overall?.[rateKey] ?? null;

  const MIN_N = 10;
  const candidates = (byAgeSex || [])
    .filter((g) => (g.n ?? 0) >= MIN_N && typeof g[rateKey] === "number")
    .sort((a, b) => b[rateKey] - a[rateKey]);

  const top = candidates.length ? candidates[0] : null;

  const confidence =
    totalN >= 200
      ? { level: "high", ar: "ثقة عالية", en: "High confidence" }
      : totalN >= 80
      ? { level: "medium", ar: "ثقة متوسطة", en: "Moderate confidence" }
      : { level: "low", ar: "ثقة منخفضة", en: "Low confidence" };

  const DECIMALS = 1;

  if (language === "ar") {
    const topPct = top ? pct(top[rateKey], DECIMALS) : null;
    const overallPct = totalRate !== null ? pct(totalRate, DECIMALS) : null;

    const topText = top
      ? `أعلى نسبة كانت لدى (العمر ${top.ageBand}, الجنس ${top.sex}) بمعدل ${topPct}% من أصل ${top.n} فحص.`
      : "لا توجد عينة كافية لاستخلاص مقارنة قوية بين الفئات (نحتاج عينات أكبر لكل فئة).";

    return {
      title: "تحليل الفئات الأكثر تأثرًا",
      summary: `ملخص ${labelSignal}: تم تحليل ${totalN} فحصًا، وبلغ عدد ${caseLabelAr} ${totalCases} (معدل إجمالي ${
        overallPct !== null ? overallPct : "غير متاح"
      }%).`,
      keyFinding: topText,
      confidenceLevel: confidence.level,
      confidenceLabel: confidence.ar,
      suggestedActions: [
        "استخدم هذا التحليل لتوجيه التدخلات (توعية/متابعة) للفئات الأكثر تأثرًا.",
        "تحقق من جودة البيانات (العمر/الجنس/تاريخ الفحص) لأن أي نقص فيها يقلل دقة الاستنتاج.",
      ],
      disclaimer:
        "هذا تحليل سكاني لدعم القرار ولا يُعد تشخيصًا فرديًا. تفسير النتائج يجب أن يتم بالتنسيق مع الجهات الصحية المختصة.",
    };
  }

  const topPct = top ? pct(top[rateKey], DECIMALS) : null;
  const overallPct = totalRate !== null ? pct(totalRate, DECIMALS) : null;

  const topText = top
    ? `Highest rate observed in (age ${top.ageBand}, sex ${top.sex}) at ${topPct}% based on ${top.n} tests.`
    : "No subgroup has sufficient sample size to support a strong comparison yet (larger samples per subgroup are needed).";

  return {
    title: "Most Affected Subgroup Analysis",
    summary: `Summary for ${labelSignal}: ${totalN} tests analyzed; ${totalCases} ${caseLabelEn} (overall rate ${
      overallPct !== null ? overallPct : "N/A"
    }%).`,
    keyFinding: topText,
    confidenceLevel: confidence.level,
    confidenceLabel: confidence.en,
    suggestedActions: [
      "Use this profiling to target interventions (education/follow-up) toward the most affected subgroups.",
      "Review data completeness (age/sex/test date) because missingness reduces interpretability.",
    ],
    disclaimer:
      "This is a population-level decision-support analysis and not an individual diagnosis. Interpret findings with public health stakeholders.",
  };
}

function summarizeGroups(map, groupKeys, extraSort = null) {
  const arr = [];
  for (const [key, v] of map.entries()) {
    const lowRate = v.n > 0 ? v.low / v.n : null;
    const highRate = v.n > 0 ? v.high / v.n : null;

    const obj = {
      ...groupKeys(key),
      n: v.n,
      low: v.low,
      lowRate: round4(lowRate),
      high: v.high,
      highRate: round4(highRate),
    };
    arr.push(obj);
  }

  const ageOrder = { "0-4": 1, "5-14": 2, "15-49": 3, "50+": 4, unknown: 99 };

  arr.sort((a, b) => {
    if (typeof extraSort === "function") {
      const v = extraSort(a, b);
      if (v !== 0) return v;
    }

    const ao = ageOrder[a.ageBand ?? "unknown"] ?? 99;
    const bo = ageOrder[b.ageBand ?? "unknown"] ?? 99;
    if (ao !== bo) return ao - bo;

    const as = String(a.sex || "");
    const bs = String(b.sex || "");
    if (as !== bs) return as.localeCompare(bs);

    const an = String(a.nationality || "");
    const bn = String(b.nationality || "");
    return an.localeCompare(bn);
  });

  return arr;
}

// ===== Main (generalized wrapper) =====
function computeSignalProfile({ rows, signalType = "anemia", testCode = null, lang = "both" }) {
  const language = normalizeLang(lang);

  // Pull metadata from registry if available
  const sig = getSignal(signalType) || {};

  // Determine direction:
  // - If anemia: low
  // - Else: from CLINICAL config for the selected testCode (fallback to registry direction)
  const codeForCfg = normalizeTestCode(testCode || sig?.testCode || "");
  const cfgDir =
    CLINICAL?.[codeForCfg]?.direction ? String(CLINICAL[codeForCfg].direction).toLowerCase() : null;
  const regDir = String(sig?.direction || "low").toLowerCase();
  const direction = (cfgDir || regDir) === "high" ? "high" : "low";

  // Labels used in narrative
  const caseLabelEn = sig?.caseLabel?.en || (direction === "high" ? "high cases" : "low cases");
  const caseLabelAr = sig?.caseLabel?.ar || (direction === "high" ? "حالات مرتفعة" : "حالات منخفضة");

  // Case definition
  const caseDef = buildCaseDef({ signalType, testCode: codeForCfg });

  let totalN = 0;
  let totalLow = 0;
  let totalHigh = 0;

  const byAge = new Map();
  const bySex = new Map();
  const byAgeSex = new Map();
  const byNationality = new Map();

  function ensure(map, key) {
    if (!map.has(key)) map.set(key, { n: 0, low: 0, high: 0 });
    return map.get(key);
  }

  for (const r of rows || []) {
    // If caller passes testCode, enforce it here
    const v = toNumericValue(r, testCode ? testCode : null);
    if (v === null) continue;

    totalN++;

    const a = ageBand(r.ageYears);
    const s = sexNorm(r.sex);
    const nat = nationalityNorm(r.nationality || r.nationalityCode || r.nat);

    // Determine low/high classification
    // - For anemia and most CLINICAL rules: we define the "case" by direction
    // - For completeness, we still compute low/high counts:
    //    * if direction is LOW: case => low
    //    * if direction is HIGH: case => high
    let isLow = false;
    let isHigh = false;

    if (caseDef) {
      const isCase = !!caseDef.isCase(v, r);
      if (caseDef.direction === "low") isLow = isCase;
      else isHigh = isCase;
    } else {
      // If no caseDef exists for this test yet, we cannot classify; count only N.
      // Keep low/high as false.
      isLow = false;
      isHigh = false;
    }

    if (isLow) totalLow++;
    if (isHigh) totalHigh++;

    // byAge
    const ba = ensure(byAge, a);
    ba.n++;
    if (isLow) ba.low++;
    if (isHigh) ba.high++;

    // bySex
    const bs = ensure(bySex, s);
    bs.n++;
    if (isLow) bs.low++;
    if (isHigh) bs.high++;

    // byAgeSex
    const k = `${a}|${s}`;
    const bas = ensure(byAgeSex, k);
    bas.n++;
    if (isLow) bas.low++;
    if (isHigh) bas.high++;

    // byNationality
    const bn = ensure(byNationality, nat);
    bn.n++;
    if (isLow) bn.low++;
    if (isHigh) bn.high++;
  }

  const overall = {
    n: totalN,

    low: totalLow,
    lowRate: round4(totalN > 0 ? totalLow / totalN : null),

    high: totalHigh,
    highRate: round4(totalN > 0 ? totalHigh / totalN : null),

    direction,
    caseCount: direction === "high" ? totalHigh : totalLow,
    caseRate: round4(totalN > 0 ? (direction === "high" ? totalHigh / totalN : totalLow / totalN) : null),
  };

  const profile = {
    overall,
    byAge: summarizeGroups(byAge, (key) => ({ ageBand: key })),
    bySex: summarizeGroups(bySex, (key) => ({ sex: key })),
    byAgeSex: summarizeGroups(byAgeSex, (key) => {
      const [ageBandKey, sexKey] = String(key).split("|");
      return { ageBand: ageBandKey, sex: sexKey };
    }),
    byNationality: summarizeGroups(
      byNationality,
      (key) => ({ nationality: key }),
      (a, b) => String(a.nationality || "").localeCompare(String(b.nationality || ""))
    ),
  };

  const insight =
    language === "both"
      ? {
          ar: buildInsight({ signalType, ...profile, language: "ar", direction, caseLabelAr, caseLabelEn }),
          en: buildInsight({ signalType, ...profile, language: "en", direction, caseLabelAr, caseLabelEn }),
        }
      : buildInsight({ signalType, ...profile, language, direction, caseLabelAr, caseLabelEn });

  return { profile, insight };
}

// ===== Backward-compatible export =====
function computeAnemiaProfile({ rows, lang = "both" }) {
  return computeSignalProfile({ rows, signalType: "anemia", testCode: "HB", lang });
}

module.exports = { computeSignalProfile, computeAnemiaProfile };
