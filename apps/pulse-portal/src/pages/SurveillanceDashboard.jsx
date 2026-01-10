// apps/pulse-portal/src/pages/surveillance/SurveillanceDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import DecisionCard from "../components/DecisionCard.jsx";
import SimpleSeriesChart from "../components/SimpleSeriesChart.jsx";
import UploadCsv from "../components/UploadCsv.jsx";

import {
  TXT,
  PRESETS,
  BOUNDS,
  getScopeOptions,
  getTestOptions,
  getSignalForTest,
  getSignalLabel,
  upper,
  safeText,
  clampNum,
  clampInt,
  fmtPct,
  extractDateRange,
  extractReport,
  fetchJSON,
  normalizeDateRange,
  pickRate,
  pickCases,
  keyLabelSex,
  safeLabel,
  fmtPctStrat,
  barWidth,
  adaptEWMA,
  adaptCUSUM,
  adaptFarrington,
  Dropdown,
  ParamSlider,
} from "./surveillance/index.js";

// ✅ ISO country localization (professional)
import { countryLabel, normalizeCountryToISO2 } from "../utils/country.js";



/* =========================
   ✅ Nationality (ISO2-first)
   ========================= */
function normalizeNationalityCode(value) {
  return normalizeCountryToISO2(value) || "UNKNOWN";
}

function localizeNationality(value, lang) {
  return countryLabel(value, lang);
}

/**
 * ✅ Consolidate nationality groups by ISO2
 * - Prevent duplicates when backend/CSV uses mixed formats (DE/DEU/Germany/ألمانيا).
 * - Produces stable grouping on nationalityCode.
 */
function consolidateNationalityGroups(items) {
  const arr = Array.isArray(items) ? items : [];
  const map = new Map();

  for (const it of arr) {
    const raw = it?.nationalityCode || it?.countryCode || it?.iso2 || it?.iso3 || it?.nationality || it?.country;
    const code = normalizeNationalityCode(raw);

    const prev = map.get(code);
    if (!prev) {
      map.set(code, {
        ...it,
        nationalityCode: code,
        // keep original in case useful
        _rawNationality: raw ?? null,
        n: Number(it?.n || 0),
        cases: Number(pickCases(it) || it?.cases || 0),
      });
    } else {
      prev.n = Number(prev.n || 0) + Number(it?.n || 0);
      prev.cases = Number(prev.cases || 0) + Number(pickCases(it) || it?.cases || 0);
    }
  }

  return Array.from(map.values()).map((x) => ({
    ...x,
    rate: x.n ? x.cases / x.n : 0,
  }));
}

/* =========================
   ✅ Trend + Confidence helpers
   ========================= */
function computeTrendFromWeekly(weekly) {
  const w = Array.isArray(weekly) ? weekly : [];
  const series = w
    .map((x) => ({ rate: typeof x?.rate === "number" ? x.rate : Number(x?.rate) }))
    .filter((p) => Number.isFinite(p.rate));

  if (series.length < 6) return "no_data";

  const last = series.slice(-6).map((x) => x.rate);
  const firstAvg = (last[0] + last[1] + last[2]) / 3;
  const lastAvg = (last[3] + last[4] + last[5]) / 3;
  const diff = lastAvg - firstAvg;

  if (diff > 0.05) return "up";
  if (diff < -0.05) return "down";
  return "flat";
}

function trendFromResults(results) {
  const r = results || {};

  const cPts = r?.cusum?.points;
  if (Array.isArray(cPts) && cPts.length) {
    const rateSeries = cPts
      .map((p) => ({ rate: typeof p?.rate === "number" ? p.rate : Number(p?.rate) }))
      .filter((x) => Number.isFinite(x.rate));
    const k = computeTrendFromWeekly(rateSeries);
    if (k !== "no_data") return k;
  }

  const ePts = r?.ewma?.points;
  if (Array.isArray(ePts) && ePts.length) {
    const zSeries = ePts
      .map((p) => ({ rate: typeof p?.z === "number" ? p.z : Number(p?.z) }))
      .filter((x) => Number.isFinite(x.rate));
    const k = computeTrendFromWeekly(zSeries);
    if (k !== "no_data") return k;
  }

  const fPts = r?.farrington?.points;
  if (Array.isArray(fPts) && fPts.length) {
    const casesSeries = fPts
      .map((p) => ({ rate: typeof p?.cases === "number" ? p.cases : Number(p?.cases) }))
      .filter((x) => Number.isFinite(x.rate));
    const k = computeTrendFromWeekly(casesSeries);
    if (k !== "no_data") return k;
  }

  return "no_data";
}

function computeConfidence(meta) {
  const dq = meta?.dataQuality || meta?.meta?.dataQuality || meta || {};
  const overallN = dq?.overallN ?? dq?.n ?? null;
  const weeksCoverage = dq?.weeksCoverage ?? dq?.weeks ?? null;

  if (typeof overallN === "number" && overallN >= 200 && typeof weeksCoverage === "number" && weeksCoverage >= 12) return "high";
  if (typeof overallN === "number" && overallN >= 60 && typeof weeksCoverage === "number" && weeksCoverage >= 6) return "med";
  return "low";
}

/* =========================
   ✅ Decision helpers
   ========================= */
function decisionTheme(decisionUpper) {
  const d = String(decisionUpper || "INFO").toUpperCase();
  if (d === "ALERT") return { key: "alert", color: "var(--alert)" };
  if (d === "WATCH") return { key: "watch", color: "var(--watch)" };
  return { key: "info", color: "var(--info)" };
}

function normDecision(x) {
  const v = String(x || "").toLowerCase();
  if (v === "alert" || v === "watch" || v === "info") return v;
  return "info";
}

function lastPointHasAlert(obj) {
  const pts = obj?.points;
  if (!Array.isArray(pts) || !pts.length) return false;
  const last = pts[pts.length - 1];
  return last?.alert === true || last?.isAlert === true || last?.flag === true || last?.alarm === true;
}

function deriveDecisionFromResults(results) {
  const ewmaA = lastPointHasAlert(results?.ewma);
  const cusumA = lastPointHasAlert(results?.cusum);
  const farrA = lastPointHasAlert(results?.farrington);

  const alertCount = [ewmaA, cusumA, farrA].filter(Boolean).length;
  if (alertCount >= 2) return "alert";
  if (alertCount === 1) return "watch";
  return "info";
}

function computeUiDecision(runData) {
  const d = normDecision(runData?.consensus?.decision);

  const pm = runData?.consensus?.perMethod || {};
  const methodLevels = Object.values(pm).map((x) => String(x?.alertLevel || "").toLowerCase());
  const consensusAlertCount = methodLevels.filter((x) => x === "alert").length;

  if (d === "alert" && consensusAlertCount === 1) return "watch";
  if (d) return d;

  return deriveDecisionFromResults(runData?.results || {});
}

function listMethodAlerts(runData) {
  const pm = runData?.consensus?.perMethod || {};
  const out = [];

  for (const k of Object.keys(pm)) {
    const lvl = String(pm[k]?.alertLevel || "").toLowerCase();
    if (lvl === "alert") out.push(k.toUpperCase());
  }

  if (!out.length) {
    const r = runData?.results || {};
    if (lastPointHasAlert(r.ewma)) out.push("EWMA");
    if (lastPointHasAlert(r.cusum)) out.push("CUSUM");
    if (lastPointHasAlert(r.farrington)) out.push("FARRINGTON");
  }

  return out;
}

function formatDate(value, lang) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return lang === "ar"
    ? d.toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/* =========================
   ✅ Precheck helpers
   ========================= */
function normalizePrecheck(resp) {
  const d = resp?.data ?? resp ?? {};
  const meta = d?.meta ?? d?.readiness ?? d ?? {};

  const overallN =
    typeof meta?.overallN === "number"
      ? meta.overallN
      : typeof meta?.n === "number"
      ? meta.n
      : typeof meta?.profile?.overall?.n === "number"
      ? meta.profile.overall.n
      : null;

  const weeksCoverage =
    typeof meta?.weeksCoverage === "number"
      ? meta.weeksCoverage
      : typeof meta?.weeks === "number"
      ? meta.weeks
      : typeof meta?.dataQuality?.weeksCoverage === "number"
      ? meta.dataQuality.weeksCoverage
      : null;

  const dateRange =
    meta?.dateRange && (meta.dateRange.start || meta.dateRange.end)
      ? meta.dateRange
      : meta?.range && (meta.range.start || meta.range.end)
      ? meta.range
      : null;

  const perMethod = meta?.perMethod || meta?.methods || null;

  return {
    ok: meta?.ok ?? true,
    overallN,
    weeksCoverage,
    dateRange,
    perMethod,
    reason: meta?.reason || null,
    raw: meta,
  };
}

/* =========================
   ✅ Page
   ========================= */
export default function SurveillanceDashboard({ lang = "en" }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);
  const isRTL = lang === "ar";
  const [popTab, setPopTab] = useState("sex"); // sex | age | nat

  const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8080";
  const apiBase = String(rawBase).replace(/\/+$/, "");

  function apiUrl(path) {
    const p = String(path || "");
    if (p.startsWith("/api/")) return `${apiBase}${p}`;
    if (p.startsWith("/")) return `${apiBase}/api${p}`;
    return `${apiBase}/api/${p}`;
  }

  async function fetchJSONSafe(url, signal) {
    try {
      return await fetchJSON(url, signal);
    } catch (e) {
      if (signal) {
        try {
          return await fetchJSON(url);
        } catch (e2) {
          throw e2;
        }
      }
      throw e;
    }
  }

  // ✅ Scope
  const [scopeMode, setScopeMode] = useState("global");
  const [facilityId, setFacilityId] = useState("");
  const [regionId, setRegionId] = useState("");

  // ✅ Test selection
  const [testCode, setTestCode] = useState("HB");
  const derivedSignal = useMemo(() => getSignalForTest(testCode), [testCode]);
  const derivedSignalLabelText = useMemo(() => getSignalLabel(t, derivedSignal), [t, derivedSignal]);

  // ✅ Methods
  const [methods, setMethods] = useState({ ewma: true, cusum: true, farrington: true });

  // ✅ Time filter + preset
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(""); // YYYY-MM-DD
  const [preset, setPreset] = useState("standard");

  // Advanced preset params
  const [ewmaLambda, setEwmaLambda] = useState(PRESETS.standard.ewma.lambda);
  const [ewmaL, setEwmaL] = useState(PRESETS.standard.ewma.L);
  const [ewmaBaselineN, setEwmaBaselineN] = useState(PRESETS.standard.ewma.baselineN);

  const [cusumBaselineN, setCusumBaselineN] = useState(PRESETS.standard.cusum.baselineN);
  const [cusumK, setCusumK] = useState(PRESETS.standard.cusum.k);
  const [cusumH, setCusumH] = useState(PRESETS.standard.cusum.h);

  const [farringtonBaselineWeeks, setFarringtonBaselineWeeks] = useState(PRESETS.standard.farrington.baselineWeeks);
  const [farringtonZ, setFarringtonZ] = useState(PRESETS.standard.farrington.z);

  useEffect(() => {
    const p = PRESETS[preset] || PRESETS.standard;
    setEwmaLambda(p.ewma.lambda);
    setEwmaL(p.ewma.L);
    setEwmaBaselineN(p.ewma.baselineN);

    setCusumBaselineN(p.cusum.baselineN);
    setCusumK(p.cusum.k);
    setCusumH(p.cusum.h);

    setFarringtonBaselineWeeks(p.farrington.baselineWeeks);
    setFarringtonZ(p.farrington.z);
  }, [preset]);

  const [loading, setLoading] = useState(false);

  const [runData, setRunData] = useState(null);
  const [reportText, setReportText] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataRange, setDataRange] = useState(null);

  const [chartsPayload, setChartsPayload] = useState(null);
  const [lastUpload, setLastUpload] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const abortRef = useRef(null);

  // ✅ Precheck state
  const [hasChecked, setHasChecked] = useState(false);
  const [readiness, setReadiness] = useState({
    loading: false,
    ok: null,
    reason: null,
    overallN: null,
    weeksCoverage: null,
    dateRange: null,
    perMethod: null,
  });

  // Health ping
  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      try {
        const j = await fetchJSONSafe(apiUrl("/health"));
        if (!cancelled) setLastUpdated(j?.time || j?.timestamp || null);
      } catch {}
    }
    loadHealth();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  function toggleMethod(key) {
    if (!hasChecked) {
      setErrMsg(lang === "ar" ? "يرجى تنفيذ «فحص البيانات» أولًا لتحديد جاهزية التحليلات." : "Please run “Check data” first to confirm readiness.");
      return;
    }
    setMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectedMethods() {
    return Object.entries(methods)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  function methodsLabel(list) {
    if (!list?.length) return t.notAvailable;
    return list.map((x) => x.toUpperCase()).join(" + ");
  }

  function buildScopeQuery() {
    const params = new URLSearchParams();

    if (scopeMode === "facility" && String(facilityId || "").trim()) {
      params.set("facilityId", String(facilityId || "").trim());
    }
    if (scopeMode === "region" && String(regionId || "").trim()) {
      params.set("regionId", String(regionId || "").trim());
    }

    const norm = normalizeDateRange(startDate, endDate);
    if (norm.start) params.set("startDate", norm.start);
    if (norm.end) params.set("endDate", norm.end);

    if (preset) params.set("preset", preset);
    if (testCode) params.set("testCode", String(testCode));

    params.set("advanced", "1");

    params.set("ewmaLambda", String(clampNum(ewmaLambda, BOUNDS.ewma.lambda.min, BOUNDS.ewma.lambda.max)));
    params.set("ewmaL", String(clampNum(ewmaL, BOUNDS.ewma.L.min, BOUNDS.ewma.L.max)));
    params.set("ewmaBaselineN", String(clampInt(ewmaBaselineN, BOUNDS.ewma.baselineN.min, BOUNDS.ewma.baselineN.max)));

    params.set("cusumBaselineN", String(clampInt(cusumBaselineN, BOUNDS.cusum.baselineN.min, BOUNDS.cusum.baselineN.max)));
    params.set("cusumK", String(clampNum(cusumK, BOUNDS.cusum.k.min, BOUNDS.cusum.k.max)));
    params.set("cusumH", String(clampNum(cusumH, BOUNDS.cusum.h.min, BOUNDS.cusum.h.max)));

    params.set(
      "farringtonBaselineWeeks",
      String(clampInt(farringtonBaselineWeeks, BOUNDS.farrington.baselineWeeks.min, BOUNDS.farrington.baselineWeeks.max))
    );
    params.set("farringtonZ", String(clampNum(farringtonZ, BOUNDS.farrington.z.min, BOUNDS.farrington.z.max)));

    return params;
  }

  function scopeLabel() {
    if (scopeMode === "global") return t.modeGlobal;
    return scopeMode === "facility"
      ? `${t.modeFacility}: ${facilityId?.trim() || t.notAvailable}`
      : `${t.modeRegion}: ${regionId?.trim() || t.notAvailable}`;
  }

  // ✅ Manual Precheck
  async function loadReadiness() {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setReadiness((p) => ({ ...p, loading: true }));
    setErrMsg("");

    try {
      const scopeParams = buildScopeQuery();
      const p = new URLSearchParams(scopeParams);
      p.set("signal", derivedSignal);
      p.set("testCode", String(testCode));
      p.set("lang", "both");
      p.set("_ts", String(Date.now()));

      const j = await fetchJSONSafe(`${apiUrl("/analytics/precheck")}?${p.toString()}`, controller.signal);
      const r = normalizePrecheck(j);

      const weeksCoverage = typeof r.weeksCoverage === "number" ? r.weeksCoverage : null;
      const overallN = typeof r.overallN === "number" ? r.overallN : null;

      setReadiness({
        loading: false,
        ok: true,
        reason: r.reason || null,
        overallN,
        weeksCoverage,
        dateRange: r.dateRange || null,
        perMethod: r.perMethod || null,
      });

      setHasChecked(true);

      if (typeof weeksCoverage === "number" && weeksCoverage < 52) {
        setMethods((prev) => ({ ...prev, farrington: false }));
      }

      if (r.dateRange?.start || r.dateRange?.end) setDataRange(r.dateRange);
    } catch (e) {
      setReadiness({
        loading: false,
        ok: false,
        reason: "PRECHECK_UNAVAILABLE",
        overallN: null,
        weeksCoverage: null,
        dateRange: null,
        perMethod: null,
      });
      setHasChecked(true);
    }
  }

  async function runAnalysis() {
    const m0 = selectedMethods();
    if (!m0.length) return;

    if (scopeMode === "facility" && !facilityId.trim()) {
      setErrMsg(t.requiredFacility);
      return;
    }
    if (scopeMode === "region" && !regionId.trim()) {
      setErrMsg(t.requiredRegion);
      return;
    }

    if (!hasChecked) {
      setErrMsg(lang === "ar" ? "يرجى تنفيذ «فحص البيانات» أولًا قبل تشغيل التحليل." : "Please run “Check data” before analysis.");
      return;
    }

    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setRunData(null);
    setReportText("");
    setErrMsg("");
    setCopied(false);
    setChartsPayload(null);
    setShowDetails(false);

    try {
      const scopeParams = buildScopeQuery();

      const weeksCoverage = typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : null;
      const farringtonAvailable = !(typeof weeksCoverage === "number" && weeksCoverage < 52);

      const m = m0.filter((x) => (x === "farrington" ? farringtonAvailable : true));
      if (!m.length) {
        setErrMsg(lang === "ar" ? "لا توجد تحليلات متاحة للتشغيل بناءً على فحص البيانات الحالي." : "No analyses are available based on the current precheck.");
        return;
      }

      const runParams = new URLSearchParams(scopeParams);
      runParams.set("signal", derivedSignal);
      runParams.set("methods", m.join(","));
      runParams.set("testCode", String(testCode));
      runParams.set("lang", "both");

      const runJ = await fetchJSONSafe(`${apiUrl("/analytics/run")}?${runParams.toString()}`, controller.signal);

      const runPayload = runJ?.data || null;
      setRunData(runPayload);

      const dr1 = extractDateRange(runJ);
      if (dr1) setDataRange(dr1);

      const results = runPayload?.results || {};
      setChartsPayload({
        ewma: results?.ewma ? { data: { ewma: results.ewma } } : null,
        cusum: results?.cusum ? { data: { cusum: results.cusum } } : null,
        farrington: results?.farrington ? { data: { farrington: results.farrington } } : null,
      });

      const reportParams = new URLSearchParams(scopeParams);
      reportParams.set("signal", derivedSignal);
      reportParams.set("testCode", String(testCode));
      reportParams.set("methods", m.join(","));
      reportParams.set("lang", lang);
      reportParams.set("_ts", String(Date.now()));

      const repJ = await fetchJSONSafe(`${apiUrl("/analytics/report")}?${reportParams.toString()}`, controller.signal);

      const extracted = extractReport(repJ?.data?.report, lang);
      const finalReport = (extracted?.trim() ? extracted : "").trim();
      setReportText(finalReport || t.insufficient);

      const repConsensus = repJ?.data?.meta?.consensus || repJ?.data?.meta?.meta?.consensus || null;
      if (repConsensus) {
        setRunData((prev) => (prev ? { ...prev, consensus: repConsensus } : prev));
      }

      try {
        const hj = await fetchJSONSafe(apiUrl("/health"), controller.signal);
        setLastUpdated(hj?.time || hj?.timestamp || null);
      } catch {}
    } catch (e) {
      if (String(e?.name) !== "AbortError") setErrMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function resetRun() {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
    }
    setLoading(false);
    setRunData(null);
    setReportText("");
    setErrMsg("");
    setCopied(false);
    setChartsPayload(null);
    setShowDetails(false);
  }

  /* =========================
     ✅ Derived UI values
     ========================= */
  const uiDecision = computeUiDecision(runData);
  const decision = upper(uiDecision);

  const theme = decisionTheme(decision);
  const decisionKey = theme.key;
  const methodAlerts = listMethodAlerts(runData);

  const weekly = runData?.meta?.weekly || runData?.meta?.meta?.weekly || runData?.weekly || null;
  const trendKey = weekly ? computeTrendFromWeekly(weekly) : trendFromResults(runData?.results);
  const confidenceKey = computeConfidence(runData?.meta || runData?.meta?.meta || runData?.meta);

  const trendLabel =
    trendKey === "up" ? t.trendUp : trendKey === "down" ? t.trendDown : trendKey === "flat" ? t.trendFlat : t.trendNoData;

  const confLabel = confidenceKey === "high" ? t.confHigh : confidenceKey === "med" ? t.confMed : t.confLow;

  const statusLabel = decision === "ALERT" ? t.alert : decision === "WATCH" ? t.watch : t.info;
  const trustMethods = methodsLabel(selectedMethods());

  const datasetValue = useMemo(() => {
    const src = lastUpload?.ok
      ? lang === "ar"
        ? "بيانات مختبرية من ملف CSV (تجربة/تحقق)"
        : "Laboratory data from uploaded CSV (pilot/validation)"
      : lang === "ar"
      ? "بيانات مختبرية من قاعدة بيانات النظام"
      : "Laboratory data from system database";

    if (scopeMode === "global") return `${src} • ${lang === "ar" ? "النطاق: الأردن (وطني)" : "Scope: Jordan (national)"}`;
    if (scopeMode === "facility")
      return `${src} • ${lang === "ar" ? "المركز الصحي" : "Facility"}: ${facilityId?.trim() || (lang === "ar" ? "غير محدد" : "unspecified")}`;
    return `${src} • ${lang === "ar" ? "المنطقة/المديرية" : "Region"}: ${regionId?.trim() || (lang === "ar" ? "غير محدد" : "unspecified")}`;
  }, [lastUpload?.ok, lang, scopeMode, facilityId, regionId]);

  const dateRangeValue = useMemo(() => {
    if (dataRange?.start || dataRange?.end) {
      const s = dataRange?.start || "—";
      const e = dataRange?.end || "—";
      return `${s} → ${e}`;
    }
    return lang === "ar" ? "كامل البيانات المتاحة ضمن النظام" : "All available data in the system";
  }, [dataRange?.start, dataRange?.end, lang]);

  const ewCfg = adaptEWMA(chartsPayload?.ewma);
  const cuCfg = adaptCUSUM(chartsPayload?.cusum);
  const faCfg = adaptFarrington(chartsPayload?.farrington);

  const presetLabel = preset === "low" ? t.presetLow : preset === "high" ? t.presetHigh : t.presetStandard;
  const canRunNow = !loading && !(readiness?.loading === true) && hasChecked;

  const profile = runData?.profile || null;
  const profileInsight = runData?.profileInsight || null;

  const insightText =
    lang === "ar"
      ? profileInsight?.ar?.keyFinding || profileInsight?.ar?.summary || ""
      : profileInsight?.en?.keyFinding || profileInsight?.en?.summary || "";

  const overallN = profile?.overall?.n ?? 0;
  const overallRate = pickRate(profile?.overall);
  const overallCases = pickCases(profile?.overall);

  const preWeeks = typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : null;
  const farringtonAvailablePre = readiness?.ok === true && typeof preWeeks === "number" ? preWeeks >= 52 : null;
  const fDisabledPre = hasChecked && farringtonAvailablePre === false;

  const fSuff = runData?.results?.farrington?.dataSufficiency || null;
  const fDisabledAfterRun = !!(fSuff && fSuff.ok === false);

  const whyText = useMemo(() => {
    const parts = [];
    parts.push(`${t.methodsUsed}: ${trustMethods}`);
    if (trendKey !== "no_data") parts.push(`${t.trend}: ${trendLabel}`);
    parts.push(`${t.confidence}: ${confLabel}`);
    return parts.join(" • ");
  }, [t, trustMethods, trendKey, trendLabel, confLabel]);

  const actionsText = useMemo(() => {
    if (uiDecision === "alert") {
      return lang === "ar"
        ? "يوصى بتفعيل مسار الاستجابة المبكر وفق بروتوكولات الترصد: التحقق من جودة البيانات، ثم مراجعة التقسيم السكاني وتحديد المرفق/المنطقة الأكثر مساهمة، والتنسيق مع الجهات المختصة حسب السلسلة المعتمدة."
        : "Recommended early-response flow per surveillance protocols: validate data quality, inspect subgroups, identify contributing facility/region, and coordinate with relevant authorities per the approved chain.";
    }
    if (uiDecision === "watch") {
      return lang === "ar"
        ? "إشارة تستدعي المتابعة: توجد مؤشرات إنذار من طريقة واحدة أو أكثر. يُنصح بالمراقبة القريبة خلال الأسابيع القادمة ومقارنة النطاقات عند توافر بيانات إضافية."
        : "Monitoring signal: one or more methods flagged. Follow closely in upcoming weeks and compare scopes as additional data arrive.";
    }
    return lang === "ar"
      ? "لا يوجد إجراء عاجل. الاستمرار بالرصد ورفع حجم البيانات يحسن الثقة الإحصائية ويقوّي حساسية الاكتشاف المبكر."
      : "No urgent action. Continue monitoring; larger data volumes improve statistical confidence and early-detection sensitivity.";
  }, [uiDecision, lang]);

  return (
    <div className="dash" dir={isRTL ? "rtl" : "ltr"}>
      <section className="panel">
        <div className="panelHeader">
          <div className="titleWrap">
            <div className="panelTitle">{t.title}</div>
            <div className="panelSub">{t.subtitle}</div>
            <div className="panelHint">{t.note}</div>
          </div>
        </div>

        <div className="infoGrid">
          <div className="infoCard">
            <div className="infoCardTitle">{t.initiativeTitle}</div>
            <div className="infoCardBody">{t.initiativeBody}</div>
          </div>

          <div className="infoCard">
            <div className="infoCardTitle">{t.pilotTitle}</div>
            <div className="infoCardBody">{t.pilotBody}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <UploadCsv
            lang={lang}
            onUploaded={(payload) => {
              setLastUpload(payload);

              const dr = payload?.dateRange;
              if (dr?.start || dr?.end) setDataRange(dr);

              setHasChecked(false);
              setReadiness({
                loading: false,
                ok: null,
                reason: null,
                overallN: null,
                weeksCoverage: null,
                dateRange: null,
                perMethod: null,
              });

              fetchJSONSafe(apiUrl("/health"))
                .then((hj) => setLastUpdated(hj?.time || hj?.timestamp || null))
                .catch(() => {});
            }}
          />
        </div>

        <div className="formRow" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t.scope}</label>
            <Dropdown
              dir={isRTL ? "rtl" : "ltr"}
              value={scopeMode}
              onChange={(v) => {
                setScopeMode(v);
                setHasChecked(false);
              }}
              options={getScopeOptions(t)}
            />
          </div>
          <div className="actions" style={{ alignSelf: "end" }} />
        </div>

        <div className="formRow">
          {scopeMode === "facility" ? (
            <div className="field">
              <label>{t.facility}</label>
              <input
                value={facilityId}
                onChange={(e) => {
                  setFacilityId(e.target.value);
                  setHasChecked(false);
                }}
                placeholder={t.placeholderFacility}
              />
            </div>
          ) : scopeMode === "region" ? (
            <div className="field">
              <label>{t.region}</label>
              <input
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  setHasChecked(false);
                }}
                placeholder={t.placeholderRegion}
              />
            </div>
          ) : (
            <div className="field">
              <label>{isRTL ? "وطني (الأردن)" : "National (Jordan)"}</label>
              <input value={t.modeGlobal} readOnly />
            </div>
          )}

          <div className="field">
            <label>{t.test}</label>
            <Dropdown
              dir={isRTL ? "rtl" : "ltr"}
              value={testCode}
              onChange={(v) => {
                setTestCode(v);
                setHasChecked(false);
              }}
              options={getTestOptions(t)}
            />
          </div>
        </div>

        <div className="formRow">
          <div className="field">
            <label>{t.signal}</label>
            <input value={derivedSignalLabelText} readOnly />
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              {t.signalHint}
            </div>
          </div>

          <div className="field" style={{ alignSelf: "end" }}>
            <div
              className="muted"
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--stroke2)",
                background: "var(--card)",
                fontSize: 12,
              }}
            >
              <b>{t.analysisNoteTitle}:</b> {t.analysisNoteBody}
            </div>
          </div>
        </div>

        {/* ✅ Time Filter (RESTORED properly) */}
        <div className="formRow">
          <div className="field">
            <label>{t.timeFilter}</label>

            <div
              className="dateRow"
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                marginTop: 8,
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{lang === "ar" ? "من تاريخ" : "Start date"}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value || "");
                    setHasChecked(false);
                  }}
                  aria-label={lang === "ar" ? "تاريخ البداية" : "Start date"}
                />
              </div>

              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>{lang === "ar" ? "إلى تاريخ" : "End date"}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value || "");
                    setHasChecked(false);
                  }}
                  aria-label={lang === "ar" ? "تاريخ النهاية" : "End date"}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="ghostBtn"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setHasChecked(false);
                }}
              >
                {t.clearDates}
              </button>
            </div>
          </div>

          <div className="field">
            <label>{t.sensitivity}</label>
            <Dropdown
              dir={isRTL ? "rtl" : "ltr"}
              value={preset}
              onChange={(v) => {
                setPreset(v);
                setHasChecked(false);
              }}
              options={[
                { value: "low", label: t.presetLow },
                { value: "standard", label: t.presetStandard },
                { value: "high", label: t.presetHigh },
              ]}
            />
            <div className="muted" style={{ marginTop: 8 }}>
              {lang === "ar" ? "إعداد الحساسية الحالي" : "Current sensitivity"}: <span className="tinyPill">{presetLabel}</span>
            </div>
          </div>
        </div>

        {/* ✅ Methods chips */}
        <div className="methodRow">
          <div className="field" style={{ flex: 1 }}>
            <label>{t.methods}</label>

            <div className="chips" role="group" aria-label={lang === "ar" ? "طرق التحليل" : "Analysis methods"}>
              <button
                type="button"
                className={`chipBtn ${methods.ewma ? "chipBtnOn" : ""} ${!hasChecked ? "chipBtnOff" : ""}`}
                onClick={() => toggleMethod("ewma")}
                disabled={!hasChecked}
                aria-pressed={!!methods.ewma}
                title={!hasChecked ? (lang === "ar" ? "افحص البيانات أولًا" : "Check data first") : ""}
              >
                EWMA
              </button>

              <button
                type="button"
                className={`chipBtn ${methods.cusum ? "chipBtnOn" : ""} ${!hasChecked ? "chipBtnOff" : ""}`}
                onClick={() => toggleMethod("cusum")}
                disabled={!hasChecked}
                aria-pressed={!!methods.cusum}
                title={!hasChecked ? (lang === "ar" ? "افحص البيانات أولًا" : "Check data first") : ""}
              >
                CUSUM
              </button>

              <button
                type="button"
                className={`chipBtn ${methods.farrington ? "chipBtnOn" : ""} ${fDisabledPre ? "chipBtnOff" : ""}`}
                title={fDisabledPre ? (lang === "ar" ? "Farrington يحتاج ≥ 52 أسبوع تغطية" : "Farrington requires ≥ 52 weeks coverage") : ""}
                onClick={() => {
                  if (fDisabledPre) return;
                  toggleMethod("farrington");
                }}
                disabled={fDisabledPre}
                aria-pressed={!!methods.farrington}
              >
                Farrington
              </button>
            </div>
          </div>

          {/* ✅ Actions */}
          <div className="actions actionsResponsive" role="group" aria-label={lang === "ar" ? "إجراءات التحليل" : "Analysis actions"}>
            <button type="button" className="ghostBtn" onClick={loadReadiness} disabled={loading || readiness?.loading}>
              {readiness?.loading ? (lang === "ar" ? "جاري الفحص…" : "Checking…") : lang === "ar" ? "فحص البيانات" : "Check data"}
            </button>

            <button type="button" className="primaryBtn" onClick={runAnalysis} disabled={!canRunNow}>
              {loading ? "…" : t.run}
            </button>

            <button type="button" className="ghostBtn" onClick={resetRun} disabled={loading}>
              {lang === "ar" ? "إعادة ضبط" : "Reset"}
            </button>
          </div>
        </div>

        {/* ✅ Precheck summary */}
        <div style={{ marginTop: 10 }}>
          {!hasChecked ? (
            <div className="muted">
              {lang === "ar"
                ? "قبل التشغيل: نفّذ «فحص البيانات» لتحديد الجاهزية والمنهجيات الممكن تشغيلها وفق التغطية وحجم العينة."
                : "Before running: click “Check data” to confirm readiness, coverage, and available methods."}
            </div>
          ) : (
            <div className="muted precheckRow">
              <span className="tinyPill">
                {lang === "ar" ? "حجم العينة (N)" : "Sample (N)"}: {typeof readiness?.overallN === "number" ? readiness.overallN : "—"}
              </span>
              <span className="tinyPill">
                {lang === "ar" ? "التغطية الزمنية (أسابيع)" : "Coverage (weeks)"}:{" "}
                {typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : "—"}
              </span>
              {fDisabledPre ? (
                <span className="tinyPill">{lang === "ar" ? "Farrington غير متاح" : "Farrington unavailable"}</span>
              ) : (
                <span className="tinyPill">{lang === "ar" ? "Farrington متاح" : "Farrington available"}</span>
              )}
              {readiness?.ok === false ? (
                <span className="tinyPill">
                  {lang === "ar" ? "تنبيه" : "Warning"}: {String(readiness?.reason || "PRECHECK_UNAVAILABLE")}
                </span>
              ) : null}
              {readiness?.reason ? (
                <span className="tinyPill">
                  {lang === "ar" ? "ملاحظة" : "Note"}: {String(readiness.reason)}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {errMsg ? (
          <div className="muted" style={{ marginTop: 10 }} role="alert" aria-live="polite">
            {t.error} {safeText(errMsg)}
            <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!hasChecked ? (
                <button type="button" className="ghostBtn" onClick={loadReadiness}>
                  {lang === "ar" ? "فحص البيانات" : "Check data"}
                </button>
              ) : (
                <button type="button" className="ghostBtn" onClick={runAnalysis}>
                  {t.retry}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* ✅ miniGrid */}
        <div className="miniGrid">
          <div className="mini">
            <div className="miniRow">
              <div className="miniKey">{t.dataset}</div>
              <div className="miniVal">{datasetValue}</div>
            </div>

            <div className="miniRow">
              <div className="miniKey">{lang === "ar" ? "الفترة الزمنية" : "Time range"}</div>
              <div className="miniVal">{dateRangeValue}</div>
            </div>

            <div className="miniRow">
              <div className="miniKey">{t.scope}</div>
              <div className="miniVal">{scopeLabel()}</div>
            </div>
          </div>

          <div className="mini">
            <div className="miniRow">
              <div className="miniKey">{t.methodsUsed}</div>
              <div className="miniVal">{trustMethods}</div>
            </div>
            <div className="miniRow">
              <div className="miniKey">{t.lastUpdated}</div>
              <div className="miniVal">{lastUpdated ? formatDate(lastUpdated, lang) : t.notAvailable}</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          ✅ Results Section
         ========================= */}
      {runData ? (
        <section className="grid">
          <div className="card cardWide" style={{ padding: 0, background: "transparent", border: "0" }}>
            <div className="statusCard">
              <div
                className="statusGlow"
                style={{
                  background:
                    decisionKey === "alert"
                      ? "radial-gradient(circle at 30% 30%, rgba(255,92,122,0.35), transparent 55%)"
                      : decisionKey === "watch"
                      ? "radial-gradient(circle at 30% 30%, rgba(255,211,105,0.30), transparent 55%)"
                      : "radial-gradient(circle at 30% 30%, rgba(47,125,255,0.28), transparent 55%)",
                }}
              />

              <div className="statusTop">
                <div>
                  <div className="statusTitle">{t.statusCardTitle}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {t.testLabel}: <b>{testCode}</b> • {t.signalLabel}: <b>{derivedSignal}</b> • {t.scopeLabel}: <b>{scopeLabel()}</b>
                  </div>
                </div>

                <div className="statusBadge" style={{ borderColor: theme.color }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: theme.color,
                      boxShadow: "0 0 0 6px rgba(255,255,255,0.06)",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 950 }}>
                    {t.status}: {statusLabel}
                  </span>
                </div>
              </div>

              <div className="statusMain">
                <div>
                  <div className="statusBig" style={{ color: theme.color }}>
                    {statusLabel}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {t.analysisNoteBody}
                  </div>
                </div>

                <div className="statusMeta">
                  <div className="kv">
                    <div className="k">{t.trend}</div>
                    <div className="v">{trendLabel}</div>
                  </div>
                  <div className="kv">
                    <div className="k">{t.confidence}</div>
                    <div className="v">{confLabel}</div>
                  </div>
                  <div className="kv">
                    <div className="k">{t.methodsUsed}</div>
                    <div className="v">{trustMethods}</div>
                  </div>
                </div>
              </div>

              <div className="statusText">
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <b>{t.why}</b> — {whyText}
                  </div>
                  <div>
                    <b>{t.actions}</b> — {actionsText}
                  </div>

                  {fDisabledPre ? (
                    <div style={{ marginTop: 2, opacity: 0.92 }}>
                      <b>{lang === "ar" ? "تنبيه تقني:" : "Technical note:"}</b>{" "}
                      {lang === "ar"
                        ? `يتطلب Farrington تغطية زمنية كافية (≥ 52 أسبوع). التغطية الحالية: ${String(preWeeks ?? "—")}.`
                        : `Farrington requires sufficient time coverage (≥ 52 weeks). Current coverage: ${String(preWeeks ?? "—")}.`}
                    </div>
                  ) : null}

                  {fDisabledAfterRun ? (
                    <div style={{ marginTop: 2, opacity: 0.92 }}>
                      <b>{lang === "ar" ? "تنبيه تقني:" : "Technical note:"}</b>{" "}
                      {lang === "ar"
                        ? `تم تعطيل إنذارات Farrington بسبب: ${String(fSuff?.reason || "INSUFFICIENT_DATA")}.`
                        : `Farrington alerts were disabled due to: ${String(fSuff?.reason || "INSUFFICIENT_DATA")}.`}
                    </div>
                  ) : null}

                  {methodAlerts?.length ? (
                    <div style={{ marginTop: 2 }}>
                      <b>{lang === "ar" ? "ملاحظة منهجية:" : "Method note:"}</b>{" "}
                      {lang === "ar"
                        ? `تم رصد مؤشر إنذار بواسطة: ${methodAlerts.join(" + ")}. الحالة العامة تعتمد قرار الإجماع (Consensus) وليس نتيجة طريقة واحدة.`
                        : `A signal was flagged by: ${methodAlerts.join(" + ")}. Overall status follows system consensus, not a single method.`}
                    </div>
                  ) : null}
                </div>

                {/* ✅ Actions under results (Copy appears only after report exists) */}
                <div className="statusActions" role="group" aria-label={lang === "ar" ? "إجراءات النتائج" : "Result actions"}>
                  <button type="button" className="linkBtn" onClick={() => setShowDetails((s) => !s)}>
                    {showDetails ? t.hideDetails : t.viewDetails}
                  </button>

                  {reportText ? (
                    <button type="button" className="primaryBtn" onClick={copyReport} aria-label={lang === "ar" ? "نسخ التقرير" : "Copy report"}>
                      {copied ? t.copied : t.report}
                    </button>
                  ) : null}

                  <span className="srOnly" role="status" aria-live="polite">
                    {copied ? (lang === "ar" ? "تم نسخ التقرير" : "Report copied") : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ Details — FULL WIDTH STACK: Charts -> Strat -> Narrative */}
          {showDetails ? (
            <>
              {/* 1) Charts */}
              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.chartsTitle}</div>
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  {t.chartsHint}
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {methods.ewma ? <SimpleSeriesChart {...ewCfg} /> : null}
                  {methods.cusum ? <SimpleSeriesChart {...cuCfg} /> : null}
                  {methods.farrington ? <SimpleSeriesChart {...faCfg} /> : null}
                </div>
              </div>

              {/* 2) Stratification */}
              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.strat}</div>
                </div>

                {!profile ? (
                  <div className="muted">{t.empty}</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        alignItems: "start",
                      }}
                    >
                      <div className="mini">
                        <div className="miniRow">
                          <div className="miniKey">{t.totalSamples}</div>
                          <div className="miniVal">{overallN}</div>
                        </div>
                        <div className="miniRow">
                          <div className="miniKey">{t.cases}</div>
                          <div className="miniVal">{overallCases ?? "—"}</div>
                        </div>
                        <div className="miniRow">
                          <div className="miniKey">{t.signalRate}</div>
                          <div className="miniVal">{fmtPct(overallRate)}</div>
                        </div>
                      </div>

                      {/* ✅ Population breakdown — SINGLE BOX */}
                      <div className="stratCard popBox">
                        <div className="popHead">
                          <div>
                            <div className="popTitle">{lang === "ar" ? "التقسيم السكاني" : "Population breakdown"}</div>
                            <div className="popSub">
                              {lang === "ar"
                                ? "عرض ضمن مربع واحد: اختر البعد (الجنس/العمر/الجنسية) ثم راجع أعلى الفئات."
                                : "Single-box view: choose dimension (sex/age/nationality) and review top groups."}
                            </div>
                          </div>

                          <div className="popSeg" role="tablist" aria-label={lang === "ar" ? "تبويبات التقسيم السكاني" : "Population breakdown tabs"}>
                            <button
                              type="button"
                              id="tab-sex"
                              role="tab"
                              aria-selected={popTab === "sex"}
                              aria-controls="panel-sex"
                              className={`popSegBtn ${popTab === "sex" ? "popSegBtnOn" : ""}`}
                              onClick={() => setPopTab("sex")}
                            >
                              {lang === "ar" ? "الجنس" : "Sex"}
                            </button>
                            <button
                              type="button"
                              id="tab-age"
                              role="tab"
                              aria-selected={popTab === "age"}
                              aria-controls="panel-age"
                              className={`popSegBtn ${popTab === "age" ? "popSegBtnOn" : ""}`}
                              onClick={() => setPopTab("age")}
                            >
                              {lang === "ar" ? "العمر" : "Age"}
                            </button>
                            <button
                              type="button"
                              id="tab-nat"
                              role="tab"
                              aria-selected={popTab === "nat"}
                              aria-controls="panel-nat"
                              className={`popSegBtn ${popTab === "nat" ? "popSegBtnOn" : ""}`}
                              onClick={() => setPopTab("nat")}
                            >
                              {lang === "ar" ? "الجنسية" : "Nationality"}
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const rawItems =
                            popTab === "sex" ? profile?.bySex || [] : popTab === "age" ? profile?.byAge || [] : profile?.byNationality || [];

                          // ✅ enforce ISO2 grouping on nationality
                          const items = popTab === "nat" ? consolidateNationalityGroups(rawItems) : rawItems;

                          const getLabel =
                            popTab === "sex"
                              ? (it) => keyLabelSex(it?.sex)
                              : popTab === "age"
                              ? (it) => safeLabel(it?.ageBand)
                              : (it) => localizeNationality(it?.nationalityCode || it?.nationality, lang);

                          const arr = Array.isArray(items) ? items : [];
                          const maxN = arr.reduce((m, it) => Math.max(m, Number(it?.n || 0)), 0) || 1;

                          if (!arr.length) return <div className="muted">{t.empty}</div>;

                          const panelId = popTab === "sex" ? "panel-sex" : popTab === "age" ? "panel-age" : "panel-nat";

                          return (
                            <div id={panelId} role="tabpanel" aria-labelledby={popTab === "sex" ? "tab-sex" : popTab === "age" ? "tab-age" : "tab-nat"}>
                              <div className="popGrid">
                                {arr
                                  .slice()
                                  .sort((a, b) => Number(b?.n || 0) - Number(a?.n || 0))
                                  .slice(0, 10)
                                  .map((it, idx) => {
                                    const label = getLabel(it);
                                    const n = Number(it?.n || 0);
                                    const rate = pickRate(it) ?? it?.rate ?? 0;
                                    const pctS = fmtPctStrat(rate);
                                    const weight = Math.round((n / maxN) * 100);

                                    return (
                                      <div className="popRow" key={idx} title={`${t.cases}: ${pickCases(it) ?? it?.cases ?? "—"} • ${t.signalRate}: ${pctS}`}>
                                        <div className="popTop">
                                          <div className="popLabel">{label}</div>
                                          <div className="popMeta">
                                            <span className="popPct">{pctS}</span>
                                            <span className="popN">{Number.isFinite(n) ? n : "—"}</span>
                                          </div>
                                        </div>

                                        <div className="popBar">
                                          <div
                                            className="popFill"
                                            style={{
                                              width: barWidth(rate),
                                              opacity: 0.75 + 0.25 * (weight / 100),
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>

                              <div className="popFooter">
                                <span className="popHintPill">{lang === "ar" ? "يعرض أعلى 10 فئات" : "Top 10 groups"}</span>
                                <span>{lang === "ar" ? "ملاحظة: النِسَب تعكس معدل الإشارة داخل كل فئة." : "Note: percentages reflect signal rate within each group."}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {insightText ? (
                      <div className="reportBox2" style={{ padding: 12, borderRadius: 12, whiteSpace: "pre-wrap", lineHeight: 1.8 }} dir={isRTL ? "rtl" : "ltr"}>
                        {insightText}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 3) Narrative */}
              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.narrative}</div>
                </div>

                <div className="reportBox2" dir={isRTL ? "rtl" : "ltr"} style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, padding: 12, borderRadius: 12, minHeight: 180 }}>
                  {reportText || t.empty}
                </div>

                {!reportText ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    {t.insufficient}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <footer className="footer">
        <div>{t.footerLine1}</div>
        <div>{t.footerLine2}</div>
        <div style={{ opacity: 0.85 }}>{t.footerLine3}</div>

        <div style={{ marginTop: 8, opacity: 0.88 }}>
          {lang === "ar"
            ? "ابتكار وتطوير: أحمد رضوان قطوم (مبتكر مستقل) — نموذج تجريبي لدعم الترصد المبكر وتعزيز كفاءة الاستجابة الصحية على المستوى الوطني بالتعاون مع الجهات ذات العلاقة."
            : "Innovation & development: Ahmad Radwan Qatoum (Independent Innovator) — pilot prototype to support early detection and strengthen national health response capacity in collaboration with relevant stakeholders."}
        </div>

        {/* ✅ Contact info */}
        <div className="footerContact" aria-label={lang === "ar" ? "معلومات التواصل" : "Contact information"}>
          <a className="footerLink" href="mailto:a.qatoum@zedne.org">
            a.qatoum@zedne.org
          </a>
          <span className="footerDot" aria-hidden="true">
            •
          </span>
          <a className="footerLink" href="tel:+962795104967">
            0795104967
          </a>
        </div>
      </footer>
    </div>
  );
}
