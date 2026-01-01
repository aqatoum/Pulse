// apps/pulse-portal/src/pages/SurveillanceDashboard.jsx
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

/* =========================
   ✅ Styles (Global-ish look)
   ========================= */
const styles = `
  :root{
    --bg: #0B1220;
    --card: rgba(255,255,255,0.06);
    --card2: rgba(0,0,0,0.22);
    --stroke: rgba(255,255,255,0.10);
    --stroke2: rgba(255,255,255,0.14);
    --text: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.70);

    --info: #10B981;
    --watch: #F59E0B;
    --alert: #EF4444;
    --ink: rgba(0,0,0,0.88);
  }

  .dash{
    min-height: 100vh;
    padding: 18px;
    display: grid;
    gap: 14px;
    background: radial-gradient(900px 600px at 15% 10%, rgba(16,185,129,0.10), transparent 55%),
                radial-gradient(900px 600px at 85% 15%, rgba(245,158,11,0.10), transparent 55%),
                radial-gradient(900px 600px at 70% 75%, rgba(239,68,68,0.08), transparent 55%),
                var(--bg);
    color: var(--text);
  }

  .panel{
    border-radius: 18px; padding: 16px;
    background: var(--card);
    border: 1px solid var(--stroke);
    backdrop-filter: blur(10px);
  }

  .panelHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
  .titleWrap{ display:grid; gap: 6px; }
  .panelTitle{ font-weight: 950; font-size: 20px; letter-spacing: .2px; }
  .panelSub{ opacity: .86; font-size: 13px; line-height: 1.55; max-width: 980px; }
  .panelHint{ opacity:.78; font-size: 12px; line-height: 1.55; max-width: 980px; }

  .infoGrid{ display:grid; grid-template-columns: 1.3fr 1fr; gap: 12px; margin-top: 10px; }
  .infoCard{
    border-radius: 16px; padding: 14px;
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.10);
  }
  .infoCardTitle{ font-weight: 950; margin-bottom: 6px; }
  .infoCardBody{ opacity: .86; font-size: 13px; line-height: 1.7; }

  .formRow{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-bottom: 10px; }
  .field label{ display:block; font-size: 12px; opacity:.85; margin-bottom: 6px; }
  .field input{
    width:100%; border-radius: 12px; border: 1px solid var(--stroke2);
    background: var(--card2); color: var(--text);
    padding: 10px 12px; outline:none;
  }
  .field input:focus{ border-color: rgba(255,255,255,0.28); box-shadow: 0 0 0 3px rgba(255,255,255,0.06); }

  .actions{ display:flex; gap: 10px; align-items:center; flex-wrap: wrap; justify-content: flex-end; }
  .primaryBtn{
    border:0; border-radius: 12px; padding: 10px 14px;
    font-weight: 950; cursor:pointer;
    background: rgba(255,255,255,0.92); color: var(--ink);
  }
  .primaryBtn:disabled{ opacity:.6; cursor:not-allowed; }
  .ghostBtn{
    border-radius: 12px; padding: 10px 14px; font-weight: 950; cursor:pointer;
    background: rgba(255,255,255,0.08); color: var(--text);
    border: 1px solid var(--stroke2);
  }
  .ghostBtn:disabled{ opacity:.55; cursor:not-allowed; }
  .dangerBtn{
    border-radius: 12px; padding: 10px 14px; font-weight: 950; cursor:pointer;
    background: rgba(245, 158, 11, 0.14); color: var(--text);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .miniGrid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 10px; }
  .mini{ border-radius: 14px; padding: 10px 12px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.10); }
  .miniRow{ display:flex; justify-content:space-between; gap: 10px; font-size: 12px; line-height: 1.6; }
  .miniKey{ opacity:.75; }
  .miniVal{ font-weight: 900; opacity:.95; text-align: end; }

  .grid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
  .card{
    border-radius: 18px; padding: 16px;
    background: var(--card);
    border: 1px solid var(--stroke);
  }
  .cardWide{ grid-column: 1 / -1; }
  .cardHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom: 10px; }
  .cardTitle{ font-weight: 950; letter-spacing: .2px; }

  .muted{ opacity:.85; font-size: 13px; line-height: 1.7; }
  .reportBox2{ background: rgba(0,0,0,0.20); border: 1px solid rgba(255,255,255,0.12); color: var(--text); }

  .tinyPill{
    display:inline-flex; align-items:center; gap:6px;
    border-radius: 999px;
    padding: 6px 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    font-weight: 900;
    font-size: 12px;
  }

  .statusCard{
    border-radius: 20px;
    padding: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.22));
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 40px rgba(0,0,0,0.28);
    overflow:hidden;
    position: relative;
  }
  .statusGlow{
    position:absolute; inset: -80px;
    filter: blur(28px);
    opacity: 0.9;
    pointer-events:none;
  }
  .statusTop{ display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; position: relative; }
  .statusTitle{ font-weight: 950; font-size: 16px; opacity: .95; }
  .statusBadge{
    display:inline-flex; align-items:center; gap: 8px;
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 950;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.18);
  }
  .statusMain{
    margin-top: 10px;
    display:grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 14px;
    position: relative;
  }
  .statusBig{
    font-size: 34px;
    font-weight: 950;
    letter-spacing: .2px;
    line-height: 1.1;
  }
  .statusMeta{ display:grid; gap: 8px; }
  .kv{ display:flex; justify-content:space-between; gap: 10px; font-size: 13px; }
  .k{ opacity: .78; }
  .v{ font-weight: 900; opacity: .95; text-align:end; }
  .statusText{
    margin-top: 12px;
    border-radius: 14px;
    padding: 12px;
    background: rgba(0,0,0,0.18);
    border: 1px solid rgba(255,255,255,0.10);
    font-size: 13px;
    line-height: 1.75;
    position: relative;
  }
  .statusText b{ font-weight: 950; }

  .linkBtn{
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 950;
    cursor:pointer;
    background: rgba(255,255,255,0.10);
    color: var(--text);
    border: 1px solid rgba(255,255,255,0.14);
  }
  .linkBtn:hover{ border-color: rgba(255,255,255,0.26); }

  /* Stratification */
  .stratGrid{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
  .stratCard{
    border-radius: 16px;
    padding: 12px;
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.10);
    overflow:hidden;
  }
  .stratTitle{ font-weight: 950; margin-bottom: 10px; display:flex; justify-content:space-between; gap: 10px; }
  .stratMeta{ opacity:.80; font-size: 12px; }
  .row{
    display:grid;
    grid-template-columns: 1.2fr .6fr .8fr;
    gap: 10px;
    align-items:center;
    margin-bottom: 8px;
  }
  .rowLabel{ font-weight: 900; opacity:.92; }
  .rowCount{ opacity:.88; font-size: 12px; text-align:end; }
  .rowPct{ font-weight: 950; text-align:end; }
  .bar{
    margin-top: 6px;
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.10);
    overflow:hidden;
  }
  .fill{
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(16,185,129,0.95), rgba(245,158,11,0.92), rgba(239,68,68,0.92));
  }

  .footer{
    margin-top: 4px;
    border-radius: 18px;
    padding: 14px 16px;
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.10);
    opacity: .90;
    font-size: 12px;
    line-height: 1.7;
    text-align: center;
  }

  @media (max-width: 980px){
    .infoGrid{ grid-template-columns: 1fr; }
  }
  @media (max-width: 960px){
    .stratGrid{ grid-template-columns: 1fr; }
  }
  @media (max-width: 860px){
    .formRow{ grid-template-columns: 1fr; }
    .grid{ grid-template-columns: 1fr; }
    .actions{ justify-content: stretch; }
    .primaryBtn,.ghostBtn,.dangerBtn,.linkBtn{ width:100%; }
    .miniVal{ text-align: start; }
    .statusMain{ grid-template-columns: 1fr; }
  }

  /* chips */
  .chipBtn{
    border-radius: 999px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    color: var(--text);
    font-weight: 950;
    cursor: pointer;
    font-size: 12px;
  }
  .chipBtnOn{
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.24);
  }
  .chipBtnOff{
    opacity: .55;
    cursor:not-allowed;
  }
`;

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

/* =========================
   ✅ Strat UI Card
   ========================= */
function StratCard({ title, items, getKey, t }) {
  const arr = Array.isArray(items) ? items : [];
  const maxN = arr.reduce((m, it) => Math.max(m, Number(it?.n || 0)), 0) || 1;

  return (
    <div className="stratCard">
      <div className="stratTitle">
        <span>{title}</span>
        <span className="stratMeta">{arr.length ? `${arr.length}` : ""}</span>
      </div>

      {!arr.length ? (
        <div className="muted">{t.empty}</div>
      ) : (
        arr.slice(0, 12).map((it, idx) => {
          const label = getKey(it);
          const n = Number(it?.n || 0);
          const rate = pickRate(it);
          const pctS = fmtPctStrat(rate);
          const weight = Math.round((n / maxN) * 100);

          return (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div className="row">
                <div className="rowLabel">{label}</div>
                <div className="rowCount">{Number.isFinite(n) ? n : "—"}</div>
                <div className="rowPct">{pctS}</div>
              </div>

              <div className="bar" title={`${t.cases}: ${pickCases(it) ?? "—"} • ${t.signalRate}: ${pctS}`}>
                <div
                  className="fill"
                  style={{
                    width: barWidth(rate),
                    opacity: 0.75 + 0.25 * (weight / 100),
                  }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* =========================
   ✅ Precheck helpers
   ========================= */
function normalizePrecheck(resp) {
  // يقبل عدة أشكال دون كسر
  // المتوقع:
  // { ok:true, overallN, weeksCoverage, dateRange:{start,end}, perMethod:{farrington:{ok,reason}} }
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

  const rawBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"; // خليه 8080 لأنه بملف server.js عندك

// ✅ توحيد: apiBase بدون سلاش في النهاية
const apiBase = String(rawBase).replace(/\/+$/, "");

// ✅ helper: يضمن وجود /api دائماً (ويمنع تكراره)
function apiUrl(path) {
  const p = String(path || "");
  if (p.startsWith("/api/")) return `${apiBase}${p}`;
  if (p.startsWith("/")) return `${apiBase}/api${p}`;
  return `${apiBase}/api/${p}`;
}


  // ✅ Scope
  const [scopeMode, setScopeMode] = useState("global");
  const [facilityId, setFacilityId] = useState("");
  const [regionId, setRegionId] = useState("");

  // ✅ Test selection
  const [testCode, setTestCode] = useState("HB");
  const derivedSignal = useMemo(() => getSignalForTest(testCode), [testCode]);
  const derivedSignalLabel = useMemo(() => getSignalForTest(testCode), [testCode]); // kept (compat)
  const derivedSignalLabelText = useMemo(() => getSignalLabel(t, derivedSignal), [t, derivedSignal]);

  // ✅ Methods
  const [methods, setMethods] = useState({ ewma: true, cusum: true, farrington: true });

  // ✅ Time filter + preset
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  // ✅ Precheck state (NEW)
  const [hasChecked, setHasChecked] = useState(false);
  const [readiness, setReadiness] = useState({ loading: false, ok: null, reason: null, overallN: null, weeksCoverage: null });

  // Health ping
  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      try {
        const j = await fetchJSON(apiUrl("/health"));

        if (!cancelled) setLastUpdated(j?.time || j?.timestamp || null);
      } catch {}
    }
    loadHealth();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  function toggleMethod(key) {
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

  // ✅ Manual Precheck (NEW) — user must click
  async function loadReadiness() {
    // abort previous request
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

      // Endpoint المقترح: /api/analytics/precheck
      // إن لم يكن موجودًا، لن يكسر الواجهة (يظهر سبب PRECHECK_UNAVAILABLE)
      const j = await fetchJSON(`${apiBase}/api/analytics/precheck?${p.toString()}`, controller.signal);
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

      // ✅ تعطيل Farrington فورًا إذا أقل من 52 أسبوع
      if (typeof weeksCoverage === "number" && weeksCoverage < 52) {
        setMethods((prev) => ({ ...prev, farrington: false }));
      }

      // Update date range UI if returned
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

  /**
   * ✅ RUN:
   * - لا يعمل قبل precheck
   * - يستبعد Farrington تلقائيًا إذا غير متاح
   */
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

    // ✅ must precheck first
    if (!hasChecked) {
      setErrMsg(lang === "ar" ? "اضغط «فحص البيانات» أولًا." : "Please click “Check data” first.");
      return;
    }

    // abort previous request
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

      // ✅ Determine Farrington availability from precheck (weeksCoverage)
      const weeksCoverage = typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : null;
      const farringtonAvailable = !(typeof weeksCoverage === "number" && weeksCoverage < 52);

      // ✅ Filter methods: drop farrington if unavailable
      const m = m0.filter((x) => (x === "farrington" ? farringtonAvailable : true));
      if (!m.length) {
        setErrMsg(
          lang === "ar"
            ? "لا توجد تحليلات متاحة للتشغيل بناءً على فحص البيانات."
            : "No analyses are available to run based on the data precheck."
        );
        return;
      }

      // ---------- RUN ----------
      const runParams = new URLSearchParams(scopeParams);
      runParams.set("signal", derivedSignal);
      runParams.set("methods", m.join(","));
      runParams.set("testCode", String(testCode));
      runParams.set("lang", "both");

      const runJ = await fetchJSON(`${apiUrl("/analytics/run")}?${runParams.toString()}`, controller.signal);

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

      // ---------- REPORT ----------
      const reportParams = new URLSearchParams(scopeParams);
      reportParams.set("signal", derivedSignal);
      reportParams.set("testCode", String(testCode));
      reportParams.set("methods", m.join(","));
      reportParams.set("lang", lang);
      reportParams.set("_ts", String(Date.now()));

      const repJ = await fetchJSON(`${apiUrl("/analytics/report")}?${reportParams.toString()}`, controller.signal);


      const extracted = extractReport(repJ?.data?.report, lang);
      const finalReport = (extracted?.trim() ? extracted : "").trim();
      setReportText(finalReport || t.insufficient);

      const repConsensus = repJ?.data?.meta?.consensus || repJ?.data?.meta?.meta?.consensus || null;
      if (repConsensus) {
        setRunData((prev) => {
          if (!prev) return prev;
          return { ...prev, consensus: repConsensus };
        });
      }

      try {
        const hj = await fetchJSON(apiUrl("/health"), controller.signal);

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

  const dataset = lastUpload?.ok ? t.uploadOk : t.notAvailable;

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

  // ✅ Farrington availability from precheck (before any analysis)
  const preWeeks = typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : null;
  const farringtonAvailablePre = readiness?.ok === true && typeof preWeeks === "number" ? preWeeks >= 52 : null;
  const fDisabledPre = hasChecked && (farringtonAvailablePre === false);

  // ✅ Farrington (backend) data sufficiency message (after analysis, if any)
  const fSuff = runData?.results?.farrington?.dataSufficiency || null;
  const fDisabledAfterRun = !!(fSuff && fSuff.ok === false);

  const whyText = (() => {
    const parts = [];
    parts.push(`${t.methodsUsed}: ${trustMethods}`);
    if (trendKey !== "no_data") parts.push(`${t.trend}: ${trendLabel}`);
    parts.push(`${t.confidence}: ${confLabel}`);
    return parts.join(" • ");
  })();

  const actionsText = (() => {
    if (uiDecision === "alert") {
      return lang === "ar"
        ? "يوصى بمراجعة الوضع فورًا: تأكيد جودة البيانات، ثم فحص التقسيم السكاني والمرفق/المنطقة الأكثر مساهمة."
        : "Immediate review recommended: validate data quality, then inspect subgroups and contributing facility/region.";
    }
    if (uiDecision === "watch") {
      return lang === "ar"
        ? "إشارة تستدعي المراقبة: يوجد تنبيه من طريقة واحدة أو أكثر. يُنصح بالمتابعة القريبة خلال الأسابيع القادمة ومقارنة النطاق عند توفر بيانات أكثر."
        : "Monitoring signal: one or more methods triggered an alert. Follow closely over the coming weeks and compare scope as more data arrive.";
    }
    return lang === "ar"
      ? "لا يوجد إجراء عاجل. الاستمرار في الرصد ورفع العينة لتحسين الثقة."
      : "No urgent action. Continue monitoring and grow sample size to improve confidence.";
  })();

  return (
    <div className="dash" dir={isRTL ? "rtl" : "ltr"}>
      <style>{styles}</style>

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
            <div className="infoCardTitle">{t.unDisclaimerTitle}</div>
            <div className="infoCardBody">{t.unDisclaimerBody}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <UploadCsv
            lang={lang}
            onUploaded={(payload) => {
              setLastUpload(payload);

              const dr = payload?.dateRange;
              if (dr?.start || dr?.end) setDataRange(dr);

              // ✅ بعد رفع جديد: نعيد حالة الفحص (مهم)
              setHasChecked(false);
              setReadiness({ loading: false, ok: null, reason: null, overallN: null, weeksCoverage: null });

              fetchJSON(apiUrl("/health"))
                .then((hj) => setLastUpdated(hj?.time || hj?.timestamp || null))
                .catch(() => {});
            }}
          />
        </div>

        <div className="formRow" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t.scope}</label>
            <Dropdown dir={isRTL ? "rtl" : "ltr"} value={scopeMode} onChange={(v) => setScopeMode(v)} options={getScopeOptions(t)} />
          </div>
          <div className="actions" style={{ alignSelf: "end" }} />
        </div>

        <div className="formRow">
          {scopeMode === "facility" ? (
            <div className="field">
              <label>{t.facility}</label>
              <input value={facilityId} onChange={(e) => setFacilityId(e.target.value)} placeholder={t.placeholderFacility} />
            </div>
          ) : scopeMode === "region" ? (
            <div className="field">
              <label>{t.region}</label>
              <input value={regionId} onChange={(e) => setRegionId(e.target.value)} placeholder={t.placeholderRegion} />
            </div>
          ) : (
            <div className="field">
              <label>{isRTL ? "الكل" : "All"}</label>
              <input value={t.modeGlobal} readOnly />
            </div>
          )}

          <div className="field">
            <label>{t.test}</label>
            <Dropdown dir={isRTL ? "rtl" : "ltr"} value={testCode} onChange={(v) => setTestCode(v)} options={getTestOptions(t)} />
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
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 12,
              }}
            >
              <b>{t.analysisNoteTitle}:</b> {t.analysisNoteBody}
            </div>
          </div>
        </div>

        <div className="formRow">
          <div className="field">
            <label>{t.timeFilter}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{t.startDate}</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setHasChecked(false);
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{t.endDate}</div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setHasChecked(false);
                  }}
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
              {lang === "ar" ? "Preset الحالي" : "Current preset"}: <span className="tinyPill">{presetLabel}</span>
            </div>
          </div>
        </div>

        <div className="methodRow" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{t.methods}</label>
            <div className="chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={`chipBtn ${methods.ewma ? "chipBtnOn" : ""}`} onClick={() => toggleMethod("ewma")}>
                EWMA
              </button>
              <button type="button" className={`chipBtn ${methods.cusum ? "chipBtnOn" : ""}`} onClick={() => toggleMethod("cusum")}>
                CUSUM
              </button>

              {/* ✅ Farrington chip becomes non-clickable if precheck says unavailable */}
              <button
                type="button"
                className={`chipBtn ${methods.farrington ? "chipBtnOn" : ""} ${fDisabledPre ? "chipBtnOff" : ""}`}
                title={
                  fDisabledPre
                    ? lang === "ar"
                      ? "Farrington يحتاج ≥ 52 أسبوع تغطية"
                      : "Farrington requires ≥ 52 weeks coverage"
                    : ""
                }
                onClick={() => {
                  if (fDisabledPre) return;
                  toggleMethod("farrington");
                }}
                disabled={fDisabledPre}
              >
                Farrington
              </button>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="dangerBtn" onClick={() => setPreset("high")} disabled={loading}>
              {t.quickHigh}
            </button>

            {/* ✅ NEW: Precheck button */}
            <button type="button" className="ghostBtn" onClick={loadReadiness} disabled={loading || readiness?.loading}>
              {readiness?.loading ? (lang === "ar" ? "جاري الفحص…" : "Checking…") : (lang === "ar" ? "فحص البيانات" : "Check data")}
            </button>

            <button type="button" className="primaryBtn" onClick={runAnalysis} disabled={!canRunNow}>
              {loading ? "…" : t.run}
            </button>

            <button type="button" className="ghostBtn" onClick={resetRun} disabled={loading}>
              Reset
            </button>

            <button type="button" className="ghostBtn" onClick={copyReport} disabled={!reportText || loading}>
              {copied ? t.copied : t.report}
            </button>
          </div>
        </div>

        {/* ✅ Precheck summary */}
        <div style={{ marginTop: 10 }}>
          {!hasChecked ? (
            <div className="muted">
              {lang === "ar"
                ? "قبل التحليل: اضغط «فحص البيانات» لتحديد التحليلات المتاحة."
                : "Before running: click “Check data” to determine which analyses are available."}
            </div>
          ) : (
            <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span className="tinyPill">
                {lang === "ar" ? "العينة N" : "Sample N"}: {typeof readiness?.overallN === "number" ? readiness.overallN : "—"}
              </span>
              <span className="tinyPill">
                {lang === "ar" ? "التغطية (أسابيع)" : "Coverage (weeks)"}: {typeof readiness?.weeksCoverage === "number" ? readiness.weeksCoverage : "—"}
              </span>
              {fDisabledPre ? (
                <span className="tinyPill">{lang === "ar" ? "Farrington غير متاح" : "Farrington unavailable"}</span>
              ) : (
                <span className="tinyPill">{lang === "ar" ? "Farrington متاح" : "Farrington available"}</span>
              )}
              {readiness?.ok === false ? (
                <span className="tinyPill">{lang === "ar" ? "تنبيه" : "Warning"}: {String(readiness?.reason || "PRECHECK_UNAVAILABLE")}</span>
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
          <div className="muted" style={{ marginTop: 10 }}>
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

        <div className="miniGrid">
          <div className="mini">
            <div className="miniRow">
              <div className="miniKey">{t.dataset}</div>
              <div className="miniVal">{dataset}</div>
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
              <div className="miniVal">{lastUpdated ? String(lastUpdated) : t.notAvailable}</div>
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
                      ? "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.35), transparent 55%)"
                      : decisionKey === "watch"
                      ? "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.32), transparent 55%)"
                      : "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.30), transparent 55%)",
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
                      boxShadow: `0 0 0 6px rgba(255,255,255,0.06)`,
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

                  {/* ✅ Info from precheck (before run) */}
                  {fDisabledPre ? (
                    <div style={{ marginTop: 2, opacity: 0.92 }}>
                      <b>{lang === "ar" ? "معلومة:" : "Info:"}</b>{" "}
                      {lang === "ar"
                        ? `Farrington يحتاج تغطية زمنية كافية (≥ 52 أسبوع). التغطية الحالية: ${String(preWeeks ?? "—")}.`
                        : `Farrington requires sufficient time coverage (≥ 52 weeks). Current coverage: ${String(preWeeks ?? "—")}.`}
                    </div>
                  ) : null}

                  {/* ✅ Info from backend (after run), if method returned disabled */}
                  {fDisabledAfterRun ? (
                    <div style={{ marginTop: 2, opacity: 0.92 }}>
                      <b>{lang === "ar" ? "معلومة:" : "Info:"}</b>{" "}
                      {lang === "ar"
                        ? `تم تعطيل إنذارات Farrington بسبب: ${String(fSuff?.reason || "INSUFFICIENT_DATA")}.`
                        : `Farrington alerts were disabled due to: ${String(fSuff?.reason || "INSUFFICIENT_DATA")}.`}
                    </div>
                  ) : null}

                  {methodAlerts?.length ? (
                    <div style={{ marginTop: 2 }}>
                      <b>{lang === "ar" ? "ملاحظة:" : "Note:"}</b>{" "}
                      {lang === "ar"
                        ? `تم رصد إنذار إحصائي بواسطة: ${methodAlerts.join(" + ")}. الحالة الرئيسية تعتمد قرار النظام (Consensus) وليس إنذار طريقة واحدة.`
                        : `A statistical alert was detected by: ${methodAlerts.join(" + ")}. The main status follows system consensus, not a single-method alert.`}
                    </div>
                  ) : null}
                </div>

                <div className="actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                  <button type="button" className="linkBtn" onClick={() => setShowDetails((s) => !s)}>
                    {showDetails ? t.hideDetails : t.viewDetails}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showDetails ? (
            <>
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

              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.strat}</div>
                </div>

                {!profile ? (
                  <div className="muted">{t.empty}</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
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

                    <div className="stratGrid">
                      <StratCard title={t.bySex} items={profile?.bySex || []} getKey={(it) => keyLabelSex(it?.sex)} t={t} />
                      <StratCard title={t.byAge} items={profile?.byAge || []} getKey={(it) => safeLabel(it?.ageBand)} t={t} />
                      <StratCard title={t.byNationality} items={profile?.byNationality || []} getKey={(it) => safeLabel(it?.nationality)} t={t} />
                    </div>

                    {insightText ? (
                      <div className="reportBox2" style={{ padding: 12, borderRadius: 12, whiteSpace: "pre-wrap", lineHeight: 1.8 }} dir={isRTL ? "rtl" : "ltr"}>
                        {insightText}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.narrative}</div>
                </div>

                <div
                  className="reportBox2"
                  dir={isRTL ? "rtl" : "ltr"}
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, padding: 12, borderRadius: 12, minHeight: 180 }}
                >
                  {reportText || t.empty}
                </div>

                {!reportText ? <div className="muted" style={{ marginTop: 8 }}>{t.insufficient}</div> : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <footer className="footer">
        <div>{t.footerLine1}</div>
        <div>{t.footerLine2}</div>
        <div style={{ opacity: 0.85 }}>{t.footerLine3}</div>
      </footer>
    </div>
  );
}
