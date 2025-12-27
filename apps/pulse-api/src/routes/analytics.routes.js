const express = require("express");
const LabResult = require("../models/LabResult");

const { computeSignalEwma, computeAnemiaEwma } = require("../services/analytics/ewma.service");
const { computeSignalCusum, computeAnemiaCusum } = require("../services/analytics/cusum.service");
const { computeSignalFarrington, computeAnemiaFarrington } = require("../services/analytics/farrington.service");

const { computeSignalProfile, computeAnemiaProfile } = require("../services/analytics/profile.service");
const { buildReport } = require("../services/analytics/report.service");

const { buildConsensus, buildSignatureInsight } = require("../services/analytics/consensus.service");

const { apiOk, apiError } = require("../utils/response");
const ANALYTICS_DEFAULTS = require("../config/analytics.defaults");

const router = express.Router();

/* ===============================
   Defaults + Presets + Bounds
   =============================== */
function getAnemiaConfig() {
  const a = ANALYTICS_DEFAULTS?.anemia || {};
  const presets = a?.presets || {};
  const bounds = a?.bounds || {};
  const defaultPreset = a?.defaultPreset || "standard";

  const standard =
    presets.standard || {
      ewma: { lambda: 0.3, L: 3, baselineN: 4 },
      cusum: { baselineN: 4, k: 0.5, h: 5.0 },
      farrington: { baselineWeeks: 8, z: 2.0 },
    };

  const high =
    presets.high || {
      ewma: { lambda: 0.45, L: 2.5, baselineN: 4 },
      cusum: { baselineN: 4, k: 0.25, h: 3.0 },
      farrington: { baselineWeeks: 6, z: 1.8 },
    };

  return {
    defaultPreset,
    presets: {
      low: presets.low || standard,
      standard,
      high,
    },
    bounds: {
      ewma:
        bounds.ewma || {
          lambda: { min: 0.1, max: 0.5 },
          L: { min: 2, max: 4 },
          baselineN: { min: 4, max: 26 },
        },
      cusum:
        bounds.cusum || {
          baselineN: { min: 4, max: 26 },
          k: { min: 0.1, max: 1.0 },
          h: { min: 2, max: 10 },
        },
      farrington:
        bounds.farrington || {
          baselineWeeks: { min: 4, max: 26 },
          z: { min: 1.5, max: 3.5 },
        },
    },
  };
}

function clampNum(v, min, max) {
  const x = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(x)) return null;
  return Math.max(min, Math.min(max, x));
}

function clampInt(v, min, max) {
  const x = parseInt(String(v), 10);
  if (!Number.isFinite(x)) return null;
  return Math.max(min, Math.min(max, x));
}

function normalizeLang(lang, fallback = "both") {
  const l = String(lang || fallback).toLowerCase();
  if (l === "ar" || l === "en" || l === "both") return l;
  return fallback;
}

function normCode(x) {
  return String(x || "").trim().toUpperCase();
}

/* ===============================
   Scope (GLOBAL / facility / region / lab)
   =============================== */
function getScope(req) {
  const facilityId = String(req.query.facilityId || "").trim();
  const regionId = String(req.query.regionId || "").trim();
  const labId = String(req.query.labId || "").trim();

  // ✅ GLOBAL allowed
  if (!facilityId && !regionId && !labId) {
    return {
      ok: true,
      scope: {
        facilityId: null,
        regionId: null,
        labId: null,
        scopeType: "GLOBAL",
        scopeId: "GLOBAL",
      },
    };
  }

  return {
    ok: true,
    scope: {
      facilityId: facilityId || null,
      regionId: regionId || null,
      labId: labId || null,
      scopeType: facilityId ? "FACILITY" : regionId ? "REGION" : "LAB",
      scopeId: facilityId || regionId || labId,
    },
  };
}

function buildBaseQuery(scope) {
  const q = {};
  if (scope.facilityId) q.facilityId = scope.facilityId;
  if (scope.regionId) q.regionId = scope.regionId;
  if (scope.labId) q.labId = scope.labId;
  return q;
}

/* ===============================
   Time range parsing + filter
   =============================== */
function parseISODate(d) {
  const s = String(d || "").trim();
  if (!s) return null;
  const x = new Date(s);
  if (Number.isNaN(x.getTime())) return null;
  return x;
}

function getDateRangeFilter(req) {
  const start = parseISODate(req.query.startDate);
  const end = parseISODate(req.query.endDate);

  let endAdj = end;
  if (endAdj) {
    endAdj = new Date(endAdj);
    endAdj.setHours(23, 59, 59, 999);
  }

  return {
    start,
    end: endAdj,
    forMeta: {
      start: start ? start.toISOString().slice(0, 10) : null,
      end: end ? end.toISOString().slice(0, 10) : null,
    },
  };
}

/* ===============================
   Params resolver (preset + advanced + bounds)
   =============================== */
function getAnemiaParams(req) {
  const cfg = getAnemiaConfig();
  const presetRaw = String(req.query.preset || cfg.defaultPreset).toLowerCase();
  const preset = cfg.presets[presetRaw] ? presetRaw : cfg.defaultPreset;

  const advanced = String(req.query.advanced || "0") === "1";
  const base = cfg.presets[preset];

  if (!advanced) {
    return {
      preset,
      locked: preset === cfg.defaultPreset,
      ewma: { ...base.ewma },
      cusum: { ...base.cusum },
      farrington: { ...base.farrington },
    };
  }

  const ewma = {
    lambda:
      clampNum(req.query.ewmaLambda, cfg.bounds.ewma.lambda.min, cfg.bounds.ewma.lambda.max) ??
      base.ewma.lambda,
    L: clampNum(req.query.ewmaL, cfg.bounds.ewma.L.min, cfg.bounds.ewma.L.max) ?? base.ewma.L,
    baselineN:
      clampInt(req.query.ewmaBaselineN, cfg.bounds.ewma.baselineN.min, cfg.bounds.ewma.baselineN.max) ??
      base.ewma.baselineN,
  };

  const cusum = {
    baselineN:
      clampInt(req.query.cusumBaselineN, cfg.bounds.cusum.baselineN.min, cfg.bounds.cusum.baselineN.max) ??
      base.cusum.baselineN,
    k: clampNum(req.query.cusumK, cfg.bounds.cusum.k.min, cfg.bounds.cusum.k.max) ?? base.cusum.k,
    h: clampNum(req.query.cusumH, cfg.bounds.cusum.h.min, cfg.bounds.cusum.h.max) ?? base.cusum.h,
  };

  const farrington = {
    baselineWeeks:
      clampInt(
        req.query.farringtonBaselineWeeks,
        cfg.bounds.farrington.baselineWeeks.min,
        cfg.bounds.farrington.baselineWeeks.max
      ) ?? base.farrington.baselineWeeks,
    z:
      clampNum(req.query.farringtonZ, cfg.bounds.farrington.z.min, cfg.bounds.farrington.z.max) ??
      base.farrington.z,
  };

  return { preset, locked: false, ewma, cusum, farrington };
}

/* ===============================
   Small helpers
   =============================== */
function latest(arr) {
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
}

function pickInterpretationForConsensus(interpretation, lang) {
  if (!interpretation) return null;
  if (lang === "both") return interpretation?.en || interpretation;
  return interpretation;
}

/* ===============================
   ✅ NEW: extract perMethod safely
   - uses interpretation if present
   - otherwise derives from results points
   =============================== */
function normalizeLevel(x, fallback = "info") {
  const v = String(x || "").toLowerCase();
  if (v === "alert" || v === "watch" || v === "info") return v;
  // sometimes services return "warning"/"warn"
  if (v === "warning" || v === "warn") return "watch";
  return fallback;
}
function normalizeConfidence(x, fallback = "low") {
  const v = String(x || "").toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  if (v === "med") return "medium";
  return fallback;
}

// tries to pull { alertLevel, confidenceLevel } from various interpretation shapes
function extractMethodInterpretation(interpretation) {
  if (!interpretation) return null;

  // if already object with desired keys
  if (typeof interpretation === "object") {
    if (interpretation.alertLevel || interpretation.confidenceLevel) {
      return {
        alertLevel: normalizeLevel(interpretation.alertLevel),
        confidenceLevel: normalizeConfidence(interpretation.confidenceLevel),
      };
    }
    // sometimes nested like { en: { alertLevel... }, ar: { ... } }
    if (interpretation.en && (interpretation.en.alertLevel || interpretation.en.confidenceLevel)) {
      return {
        alertLevel: normalizeLevel(interpretation.en.alertLevel),
        confidenceLevel: normalizeConfidence(interpretation.en.confidenceLevel),
      };
    }
  }

  return null;
}

function deriveFromResult(resultObj, methodName) {
  const pts = resultObj?.points;
  const last = latest(pts);

  // try common shapes
  const hasAlert =
    last?.alert === true ||
    last?.isAlert === true ||
    last?.flag === true ||
    last?.alarm === true;

  // some engines store "alertLevel" per point
  const pointLevel = normalizeLevel(last?.alertLevel || last?.level || null, null);

  // Farrington commonly uses UCL comparison, but we avoid heavy logic in routes.
  const alertLevel = pointLevel || (hasAlert ? "alert" : "info");

  // confidence: very rough heuristic based on point count
  const nPts = Array.isArray(pts) ? pts.length : 0;
  const confidenceLevel = nPts >= 12 ? "high" : nPts >= 4 ? "medium" : "low";

  return { alertLevel, confidenceLevel };
}

function computeConsensusFromPerMethod(perMethod) {
  const levels = Object.values(perMethod || {}).map((x) => normalizeLevel(x?.alertLevel, "info"));
  const alertCount = levels.filter((l) => l === "alert").length;
  const watchCount = levels.filter((l) => l === "watch").length;

  let decision = "info";
  if (alertCount > 0) decision = "alert";
  else if (watchCount > 0) decision = "watch";

  return {
    decision,
    counts: { alert: alertCount, watch: watchCount },
    perMethod,
  };
}

/* ===============================
   Response helper: scope at top
   =============================== */
function withScopeTop(scopeRes) {
  return {
    scope: {
      type: scopeRes.scope.scopeType, // GLOBAL | FACILITY | REGION | LAB
      id: scopeRes.scope.scopeId,
      labId: scopeRes.scope.labId || null,
      regionId: scopeRes.scope.regionId || null,
      facilityId: scopeRes.scope.facilityId || null,
    },
    facilityId: scopeRes.scope.scopeId, // backward compatibility
  };
}

/* ===============================
   ✅ Load rows for ANY testCode
   rows returned contain: { value, testDate, sex, ageYears, nationality, testCode }
   =============================== */
async function loadSignalRows({ scope, dateFilter, testCode }) {
  const tc = normCode(testCode);
  if (!tc)
    return {
      rows: [],
      dateRange: { start: null, end: null, filtered: dateFilter?.forMeta || {} },
      rawCount: 0,
    };

  const q = {
    ...buildBaseQuery(scope),
    testCode: tc,
  };

  if (dateFilter?.start || dateFilter?.end) {
    const range = {};
    if (dateFilter.start) range.$gte = dateFilter.start;
    if (dateFilter.end) range.$lte = dateFilter.end;
    q.$or = [{ testDate: range }, { collectedAt: range }];
  }

  const docs = await LabResult.find(q)
    .select({
      testCode: 1,
      value: 1,
      testDate: 1,
      collectedAt: 1,
      sex: 1,
      ageYears: 1,
      nationality: 1,
      facilityId: 1,
      regionId: 1,
      labId: 1,
      uploadId: 1,
    })
    .sort({ testDate: 1, collectedAt: 1 })
    .lean();

  const rows = (docs || [])
    .map((r) => {
      const v = typeof r.value === "number" ? r.value : Number(r.value);
      const dt = r.testDate || r.collectedAt || null;
      return {
        testCode: r.testCode,
        value: v,
        testDate: dt,
        sex: r.sex,
        ageYears: r.ageYears,
        nationality: r.nationality || "unknown",
      };
    })
    .filter((r) => r.testDate && Number.isFinite(r.value));

  let min = null;
  let max = null;
  for (const r of rows) {
    const d = r?.testDate ? new Date(r.testDate) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }

  const dateRange = {
    start: min ? min.toISOString().slice(0, 10) : null,
    end: max ? max.toISOString().slice(0, 10) : null,
    filtered: dateFilter?.forMeta || { start: null, end: null },
  };

  return { rows, dateRange, rawCount: docs?.length || 0 };
}

/* ===============================
   Data quality summary (trust indicators)
   =============================== */
function computeDataQuality({ profile, results }) {
  const overallN = profile?.overall?.n ?? 0;

  const weeksCoverage = Math.max(
    results?.ewma?.points?.length ?? 0,
    results?.cusum?.points?.length ?? 0,
    results?.farrington?.points?.length ?? 0
  );

  const recentN =
    latest(results?.ewma?.points)?.n ??
    latest(results?.cusum?.points)?.n ??
    latest(results?.farrington?.points)?.n ??
    null;

  return {
    overallN,
    recentN,
    weeksCoverage,
    smallN: overallN < 20,
    sparseSeries: weeksCoverage > 0 && weeksCoverage < 4,
  };
}

/* ===============================
   ✅ PROFILE (generic via old endpoint)
   /api/analytics/anemia-profile?signal=crp&testCode=CRP
   =============================== */
router.get("/anemia-profile", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const signal = String(req.query.signal || "anemia").trim().toLowerCase();
    const testCode = normCode(req.query.testCode || (signal === "anemia" ? "HB" : ""));

    const dateFilter = getDateRangeFilter(req);
    const { rows, dateRange } = await loadSignalRows({ scope: scopeRes.scope, dateFilter, testCode });

    const out =
      signal === "anemia"
        ? computeAnemiaProfile({ rows, lang })
        : computeSignalProfile({ rows, signalType: signal, testCode, lang });

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: signal,
          method: "PROFILE",
          params: {
            signal,
            testCode,
            lang,
            ...scopeRes.scope,
          },
          dateRange,
        },
        data: {
          ...(out || {}),
          dateRange,
          meta: { overallN: out?.profile?.overall?.n ?? 0 },
        },
      })
    );
  } catch (err) {
    console.error("PROFILE error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   ✅ RUN — /api/analytics/run
   =============================== */
router.get("/run", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const signal = String(req.query.signal || "anemia").trim().toLowerCase();
    const testCode = normCode(req.query.testCode || (signal === "anemia" ? "HB" : ""));

    const params = getAnemiaParams(req); // reuse same params for all signals
    const dateFilter = getDateRangeFilter(req);

    const methodsRaw = String(req.query.methods || "ewma,cusum,farrington");
    const methods = methodsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((x) => ["ewma", "cusum", "farrington"].includes(x));

    if (!methods.length) {
      return res.status(400).json(apiError({ status: 400, error: "methods is required" }));
    }

    const { rows, dateRange } = await loadSignalRows({ scope: scopeRes.scope, dateFilter, testCode });

    const results = {};
    const interpretations = {};

    for (const method of methods) {
      if (method === "ewma") {
        const fn = signal === "anemia" ? computeAnemiaEwma : computeSignalEwma;
        const { ewma, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.ewma,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.ewma = ewma;
        interpretations.ewma = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "cusum") {
        const fn = signal === "anemia" ? computeAnemiaCusum : computeSignalCusum;
        const { cusum, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.cusum,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.cusum = cusum;
        interpretations.cusum = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "farrington") {
        const fn = signal === "anemia" ? computeAnemiaFarrington : computeSignalFarrington;
        const { farrington, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.farrington,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.farrington = farrington;
        interpretations.farrington = pickInterpretationForConsensus(interpretation, lang);
      }
    }

    // ✅ Profile (stratification)
    const profOut =
      signal === "anemia"
        ? computeAnemiaProfile({ rows, lang: "both" })
        : computeSignalProfile({ rows, signalType: signal, testCode, lang: "both" });

    const profile = profOut?.profile || null;
    const profileInsight = profOut?.insight || null;

    // ✅ First consensus (keep your service)
    let consensus = buildConsensus({ interpretations, methods });

    // ✅ Signature Insight
    const signatureInsight =
      lang === "both"
        ? {
            ar: {
              ...buildSignatureInsight({ signalType: signal, consensus, methods, language: "ar" }),
              stratificationKeyFinding: profileInsight?.ar?.keyFinding ?? null,
            },
            en: {
              ...buildSignatureInsight({ signalType: signal, consensus, methods, language: "en" }),
              stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
            },
          }
        : {
            ...buildSignatureInsight({ signalType: signal, consensus, methods, language: lang }),
            stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
          };

    const dataQuality = computeDataQuality({ profile, results });

    // ==========================
    // ✅ FIX #1: ensure consensus.perMethod is filled
    // ==========================
    const perMethod = {};
    for (const method of methods) {
      const interp = extractMethodInterpretation(interpretations?.[method]);
      if (interp) {
        perMethod[method] = interp;
      } else {
        const r = results?.[method];
        perMethod[method] = deriveFromResult(r, method);
      }
    }

    // if consensus service returned empty perMethod, overwrite with ours
    const computedConsensus = computeConsensusFromPerMethod(perMethod);

    // keep original consensus if it contains extra fields, but force perMethod + counts + decision to be consistent
    consensus = {
      ...(consensus || {}),
      decision: computedConsensus.decision,
      counts: computedConsensus.counts,
      perMethod: computedConsensus.perMethod,
    };

    // ==========================
    // ✅ FIX #2: data quality note ALWAYS when data insufficient
    // ==========================
    const notEnoughData = (dataQuality?.overallN ?? 0) < 20 || (dataQuality?.weeksCoverage ?? 0) < 4;

    if (notEnoughData) {
      const noteAr =
        "ملاحظة جودة: حجم العينة أو التغطية الزمنية غير كافيين للحكم بثقة عالية. اعتبر النتيجة استرشادية حتى تتوفر بيانات أكثر.";
      const noteEn =
        "Data quality note: sample size or time coverage is insufficient for high-confidence inference. Treat this as indicative until more data are available.";

      if (signatureInsight?.ar) signatureInsight.ar.dataQualityNote = noteAr;
      if (signatureInsight?.en) signatureInsight.en.dataQualityNote = noteEn;
    }

    // still keep downgrade rule only if ALERT (optional extra safety)
    if (notEnoughData && String(consensus?.decision || "").toLowerCase() === "alert") {
      consensus.decision = "watch";
      const noteAr2 =
        "ملاحظة جودة: تم تخفيض القرار من ALERT إلى WATCH لأن البيانات غير كافية لإنذار موثوق.";
      const noteEn2 =
        "Data quality note: Decision was downgraded from ALERT to WATCH due to insufficient data for a reliable alert.";
      if (signatureInsight?.ar) signatureInsight.ar.dataQualityNote = noteAr2;
      if (signatureInsight?.en) signatureInsight.en.dataQualityNote = noteEn2;
    }

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: signal,
          method: "RUN",
          params: {
            signal,
            testCode,
            methods,
            lang,
            ...scopeRes.scope,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
            locked: params.locked,
          },
          dateRange,
        },
        data: {
          consensus,
          signatureInsight,
          results,
          profile,
          profileInsight,
          meta: { dataQuality, dateRange },
        },
      })
    );
  } catch (err) {
    console.error("RUN error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   REPORT — /api/analytics/report
   ✅ FIXED: consensus must match /run (no contradictions)
   =============================== */
router.get("/report", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const signal = String(req.query.signal || "anemia").trim().toLowerCase();
    const testCode = normCode(req.query.testCode || (signal === "anemia" ? "HB" : ""));

    const params = getAnemiaParams(req);
    const dateFilter = getDateRangeFilter(req);

    const methodsRaw = String(req.query.methods || "ewma,cusum,farrington");
    const methods = methodsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((x) => ["ewma", "cusum", "farrington"].includes(x));

    if (!methods.length) {
      return res.status(400).json(apiError({ status: 400, error: "methods is required" }));
    }

    const { rows, dateRange } = await loadSignalRows({ scope: scopeRes.scope, dateFilter, testCode });

    const results = {};
    const interpretationsForConsensus = {};

    // ==========================
    // Compute selected methods
    // ==========================
    for (const method of methods) {
      if (method === "ewma") {
        const fn = signal === "anemia" ? computeAnemiaEwma : computeSignalEwma;
        const { ewma, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.ewma,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.ewma = ewma;
        interpretationsForConsensus.ewma = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "cusum") {
        const fn = signal === "anemia" ? computeAnemiaCusum : computeSignalCusum;
        const { cusum, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.cusum,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.cusum = cusum;
        interpretationsForConsensus.cusum = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "farrington") {
        const fn = signal === "anemia" ? computeAnemiaFarrington : computeSignalFarrington;
        const { farrington, interpretation } = fn({
          rows,
          signalType: signal,
          testCode,
          ...params.farrington,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.farrington = farrington;
        interpretationsForConsensus.farrington = pickInterpretationForConsensus(interpretation, lang);
      }
    }

    // ==========================
    // Profile (stratification)
    // ==========================
    const profOut =
      signal === "anemia"
        ? computeAnemiaProfile({ rows, lang: "both" })
        : computeSignalProfile({ rows, signalType: signal, testCode, lang: "both" });

    const profile = profOut?.profile || null;
    const profileInsight = profOut?.insight || null;

    // ==========================
    // ✅ FIX #1: Make consensus consistent with method points
    // ==========================
    const perMethod = {};
    for (const method of methods) {
      const interp = extractMethodInterpretation(interpretationsForConsensus?.[method]);
      if (interp) perMethod[method] = interp;
      else perMethod[method] = deriveFromResult(results?.[method], method);
    }
    const computedConsensus = computeConsensusFromPerMethod(perMethod);

    // buildConsensus may contain extra fields; keep them but FORCE decision/perMethod
    let consensus = buildConsensus({ interpretations: interpretationsForConsensus, methods }) || {};
    consensus = {
      ...consensus,
      decision: computedConsensus.decision,
      counts: computedConsensus.counts,
      perMethod: computedConsensus.perMethod,
    };

    // ==========================
    // Signature Insight
    // ==========================
    let signatureInsight =
      lang === "both"
        ? {
            ar: {
              ...buildSignatureInsight({ signalType: signal, consensus, methods, language: "ar" }),
              stratificationKeyFinding: profileInsight?.ar?.keyFinding ?? null,
            },
            en: {
              ...buildSignatureInsight({ signalType: signal, consensus, methods, language: "en" }),
              stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
            },
          }
        : {
            ...buildSignatureInsight({ signalType: signal, consensus, methods, language: lang }),
            stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
          };

    // ==========================
    // Data quality
    // ==========================
    const dataQuality = computeDataQuality({ profile, results });

    // ==========================
    // ✅ FIX #2: Always add data-quality note when insufficient
    // ==========================
    const notEnoughData = (dataQuality?.overallN ?? 0) < 20 || (dataQuality?.weeksCoverage ?? 0) < 4;

    if (notEnoughData) {
      const noteAr =
        "ملاحظة جودة: حجم العينة أو التغطية الزمنية غير كافيين للحكم بثقة عالية. اعتبر النتيجة استرشادية حتى تتوفر بيانات أكثر.";
      const noteEn =
        "Data quality note: sample size or time coverage is insufficient for high-confidence inference. Treat this as indicative until more data are available.";
      if (signatureInsight?.ar) signatureInsight.ar.dataQualityNote = noteAr;
      if (signatureInsight?.en) signatureInsight.en.dataQualityNote = noteEn;
    }

    // same downgrade rule as /run
    if (notEnoughData && String(consensus?.decision || "").toLowerCase() === "alert") {
      consensus.decision = "watch";
      const noteAr2 = "ملاحظة جودة: تم تخفيض القرار من ALERT إلى WATCH لأن البيانات غير كافية لإنذار موثوق.";
      const noteEn2 = "Data quality note: Decision was downgraded from ALERT to WATCH due to insufficient data for a reliable alert.";
      if (signatureInsight?.ar) signatureInsight.ar.dataQualityNote = noteAr2;
      if (signatureInsight?.en) signatureInsight.en.dataQualityNote = noteEn2;
    }

    // ==========================
    // Build report (existing service)
    // ==========================
    const built = buildReport({
      facilityId: scopeRes.scope.scopeId,
      signalType: signal,
      testCode,
      methods,
      consensus,
      signatureInsight,
      profile,
      lang,
      weeksCount: dataQuality.weeksCoverage,
      baselineStd: results?.ewma?.baselineStd ?? null,

      // extra meta (safe if buildReport ignores them)
      dataQuality,
      decision: consensus?.decision,
    });

    let reportText = "";
    let translations = null;

    if (lang === "both") {
      reportText = String(built?.en || "");
      translations = { ar: String(built?.ar || ""), en: String(built?.en || "") };
    } else {
      reportText = String(built || "");
    }

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: signal,
          method: "REPORT",
          params: {
            signal,
            testCode,
            methods,
            lang,
            ...scopeRes.scope,
            locked: params.locked,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
          },
          dateRange,
        },
        data: {
          report: reportText,
          ...(translations ? { translations } : {}),
          meta: { dataQuality, dateRange, consensus },
        },
        interpretation: null,
      })
    );
  } catch (err) {
    console.error("REPORT error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   Backward-compat alias
   =============================== */
router.get("/anemia-report", (req, res, next) => {
  req.url = req.url.replace(/^\/anemia-report/, "/report");
  return router.handle(req, res, next);
});

module.exports = router;
