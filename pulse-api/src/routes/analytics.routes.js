const express = require("express");
const LabResult = require("../models/LabResult");

const { computeAnemiaEwma } = require("../services/analytics/ewma.service");
const { computeAnemiaCusum } = require("../services/analytics/cusum.service");
const { computeAnemiaFarrington } = require("../services/analytics/farrington.service");
const { computeAnemiaProfile } = require("../services/analytics/profile.service");
const { buildReport } = require("../services/analytics/report.service");

const {
  buildConsensus,
  buildSignatureInsight,
} = require("../services/analytics/consensus.service");

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

/* ===============================
   Scope (facility/region/lab)
   =============================== */
function getScope(req) {
  const facilityId = String(req.query.facilityId || "").trim();
  const regionId = String(req.query.regionId || "").trim();
  const labId = String(req.query.labId || "").trim();

  if (!facilityId && !regionId) {
    return { ok: false, error: "facilityId or regionId is required" };
  }

  return {
    ok: true,
    scope: {
      facilityId: facilityId || null,
      regionId: regionId || null,
      labId: labId || null,
      scopeType: facilityId ? "FACILITY" : "REGION",
      scopeId: facilityId ? facilityId : regionId,
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
    z: clampNum(req.query.farringtonZ, cfg.bounds.farrington.z.min, cfg.bounds.farrington.z.max) ?? base.farrington.z,
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
   Response helper: add scope (FACILITY/REGION)
   Keep facilityId for backward compatibility.
   =============================== */
function withScopeTop(scopeRes) {
  return {
    scope: {
      type: scopeRes.scope.scopeType, // "FACILITY" | "REGION"
      id: scopeRes.scope.scopeId,
      labId: scopeRes.scope.labId || null,
      regionId: scopeRes.scope.regionId || null,
      facilityId: scopeRes.scope.facilityId || null,
    },
    // backward compatibility: some frontends read facilityId
    facilityId: scopeRes.scope.scopeId,
  };
}

/* ===============================
   Load HB rows then map -> legacy shape for services
   Services expect: { hb, testDate, sex, ageYears }
   ✅ يدعم dateFilter فعليًا
   =============================== */
async function loadAnemiaRows({ scope, dateFilter }) {
  const hbCodes = ["HB", "HGB"];

  const q = {
    ...buildBaseQuery(scope),
    testCode: { $in: hbCodes },
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
      facilityId: 1,
      regionId: 1,
      labId: 1,
      uploadId: 1,
    })
    .sort({ testDate: 1, collectedAt: 1 })
    .lean();

  const rows = (docs || [])
    .map((r) => {
      const hb = typeof r.value === "number" ? r.value : Number(r.value);
      const dt = r.testDate || r.collectedAt || null;

      return {
        hb,
        testDate: dt,
        sex: r.sex,
        ageYears: r.ageYears,
      };
    })
    .filter((r) => r.testDate && Number.isFinite(r.hb));

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
   EWMA
   =============================== */
router.get("/anemia-ewma", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const params = getAnemiaParams(req);
    const dateFilter = getDateRangeFilter(req);

    const { rows, dateRange } = await loadAnemiaRows({ scope: scopeRes.scope, dateFilter });

    const { ewma, interpretation } = computeAnemiaEwma({
      rows,
      ...params.ewma,
      lang,
      preset: params.preset,
      timeRange: dateRange.filtered,
    });

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: "anemia",
          method: "EWMA",
          params: {
            ...params.ewma,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
            lang,
            ...scopeRes.scope,
            locked: params.locked,
          },
          dateRange,
        },
        data: { ewma, dateRange },
        interpretation,
      })
    );
  } catch (err) {
    console.error("EWMA error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   CUSUM
   =============================== */
router.get("/anemia-cusum", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const params = getAnemiaParams(req);
    const dateFilter = getDateRangeFilter(req);

    const { rows, dateRange } = await loadAnemiaRows({ scope: scopeRes.scope, dateFilter });

    const { cusum, interpretation } = computeAnemiaCusum({
      rows,
      ...params.cusum,
      lang,
      preset: params.preset,
      timeRange: dateRange.filtered,
    });

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: "anemia",
          method: "CUSUM",
          params: {
            ...params.cusum,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
            lang,
            ...scopeRes.scope,
            locked: params.locked,
          },
          dateRange,
        },
        data: { cusum, dateRange },
        interpretation,
      })
    );
  } catch (err) {
    console.error("CUSUM error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   FARRINGTON
   =============================== */
router.get("/anemia-farrington", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const params = getAnemiaParams(req);
    const dateFilter = getDateRangeFilter(req);

    const { rows, dateRange } = await loadAnemiaRows({ scope: scopeRes.scope, dateFilter });

    const { farrington, interpretation } = computeAnemiaFarrington({
      rows,
      ...params.farrington,
      lang,
      preset: params.preset,
      timeRange: dateRange.filtered,
    });

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: "anemia",
          method: "FARRINGTON",
          params: {
            ...params.farrington,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
            lang,
            ...scopeRes.scope,
            locked: params.locked,
          },
          dateRange,
        },
        data: { farrington, dateRange },
        interpretation,
      })
    );
  } catch (err) {
    console.error("FARRINGTON error:", err);
    return res.status(500).json(apiError({ status: 500, error: "Server error", details: err.message }));
  }
});

/* ===============================
   REPORT — /api/analytics/report
   =============================== */
router.get("/report", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const lang = normalizeLang(req.query.lang, "both");
    const params = getAnemiaParams(req);
    const dateFilter = getDateRangeFilter(req);

    const methodsRaw = String(req.query.methods || "ewma,cusum,farrington");
    const methods = methodsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((x) => ["ewma", "cusum", "farrington"].includes(x));

    const { rows, dateRange } = await loadAnemiaRows({ scope: scopeRes.scope, dateFilter });

    const results = {};
    const interpretationsForConsensus = {};

    for (const method of methods) {
      if (method === "ewma") {
        const { ewma, interpretation } = computeAnemiaEwma({
          rows,
          lang,
          ...params.ewma,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.ewma = ewma;
        interpretationsForConsensus.ewma = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "cusum") {
        const { cusum, interpretation } = computeAnemiaCusum({
          rows,
          lang,
          ...params.cusum,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.cusum = cusum;
        interpretationsForConsensus.cusum = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "farrington") {
        const { farrington, interpretation } = computeAnemiaFarrington({
          rows,
          lang,
          ...params.farrington,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.farrington = farrington;
        interpretationsForConsensus.farrington = pickInterpretationForConsensus(interpretation, lang);
      }
    }

    const consensus = buildConsensus({ interpretations: interpretationsForConsensus, methods });

    const { profile, insight: profileInsight } = computeAnemiaProfile({ rows, lang: "both" });

    const signatureInsight =
      lang === "both"
        ? {
            ar: {
              ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: "ar" }),
              stratificationKeyFinding: profileInsight?.ar?.keyFinding ?? null,
            },
            en: {
              ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: "en" }),
              stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
            },
          }
        : {
            ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: lang }),
            stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
          };

    const dataQuality = computeDataQuality({ profile, results });

    const built = buildReport({
      facilityId: scopeRes.scope.scopeId, // (مسمى قديم داخل report.service)
      signalType: "anemia",
      methods,
      consensus,
      signatureInsight,
      profile,
      lang,
      weeksCount: dataQuality.weeksCoverage,
      baselineStd: results?.ewma?.baselineStd ?? null,
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
          signalType: "anemia",
          method: "REPORT",
          params: {
            methods,
            lang,
            ...scopeRes.scope,
            locked: params.locked,
            preset: params.preset,
            advanced: String(req.query.advanced || "0") === "1",
            tunedDefaults: params,
          },
          dateRange,
        },
        data: {
          report: reportText,
          ...(translations ? { translations } : {}),
          meta: { dataQuality, dateRange },
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
   RUN — /api/analytics/run
   =============================== */
router.get("/run", async (req, res) => {
  try {
    const scopeRes = getScope(req);
    if (!scopeRes.ok) return res.status(400).json(apiError({ status: 400, error: scopeRes.error }));

    const signal = String(req.query.signal || "anemia").trim().toLowerCase();
    if (signal !== "anemia") {
      return res.status(400).json(apiError({ status: 400, error: "Only signal=anemia is supported currently" }));
    }

    const lang = normalizeLang(req.query.lang, "both");
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

    const { rows, dateRange } = await loadAnemiaRows({ scope: scopeRes.scope, dateFilter });

    const results = {};
    const interpretations = {};

    for (const method of methods) {
      if (method === "ewma") {
        const { ewma, interpretation } = computeAnemiaEwma({
          rows,
          ...params.ewma,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.ewma = ewma;
        interpretations.ewma = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "cusum") {
        const { cusum, interpretation } = computeAnemiaCusum({
          rows,
          ...params.cusum,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.cusum = cusum;
        interpretations.cusum = pickInterpretationForConsensus(interpretation, lang);
      }

      if (method === "farrington") {
        const { farrington, interpretation } = computeAnemiaFarrington({
          rows,
          ...params.farrington,
          lang,
          preset: params.preset,
          timeRange: dateRange.filtered,
        });
        results.farrington = farrington;
        interpretations.farrington = pickInterpretationForConsensus(interpretation, lang);
      }
    }

    const consensus = buildConsensus({ interpretations, methods });

    const { profile, insight: profileInsight } = computeAnemiaProfile({ rows, lang: "both" });

    const signatureInsight =
      lang === "both"
        ? {
            ar: {
              ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: "ar" }),
              stratificationKeyFinding: profileInsight?.ar?.keyFinding ?? null,
            },
            en: {
              ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: "en" }),
              stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
            },
          }
        : {
            ...buildSignatureInsight({ signalType: "anemia", consensus, methods, language: lang }),
            stratificationKeyFinding: profileInsight?.en?.keyFinding ?? null,
          };

    const dataQuality = computeDataQuality({ profile, results });

    return res.json(
      apiOk({
        ...withScopeTop(scopeRes),
        analysis: {
          signalType: "anemia",
          method: "RUN",
          params: {
            signal,
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
   Backward-compat alias
   =============================== */
router.get("/anemia-report", (req, res, next) => {
  req.url = req.url.replace(/^\/anemia-report/, "/report");
  return router.handle(req, res, next);
});

module.exports = router;
