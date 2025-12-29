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

  /* Modal */
  .modalOverlay{
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    display:flex;
    align-items:center;
    justify-content:center;
    padding: 16px;
    z-index: 9999;
  }
  .modal{
  width: min(1100px, 100%);
  max-height: calc(100vh - 32px);   /* ✅ prevent overflow outside screen */
  border-radius: 18px;
  background: rgba(12,18,32,0.92);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 18px 60px rgba(0,0,0,0.45);
  overflow:hidden;
  display:flex;
  flex-direction: column;          /* ✅ header fixed, body scrolls */
}

.modalBody{
  padding: 14px 16px;
  overflow: auto;                  /* ✅ scroll inside */
  max-height: calc(100vh - 120px); /* ✅ leaves room for header */
  -webkit-overflow-scrolling: touch;
}

  .modalHeader{
    display:flex;
    justify-content:space-between;
    gap: 10px;
    align-items:flex-start;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
  }
  .modalTitle{ font-weight: 950; }
  .modalBody{ padding: 14px 16px; }
  .table{
    width: 100%;
    border-collapse: collapse;
    overflow:hidden;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
  }
  .table th, .table td{
    padding: 10px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    text-align: start;
    vertical-align: top;
  }
  .table th{ font-weight: 950; background: rgba(255,255,255,0.06); }
  .table tr:last-child td{ border-bottom: 0; }

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
`;

/* =========================
   ✅ Trend + Confidence (simple, explainable)
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

function computeConfidence(meta) {
  const dq = meta?.dataQuality || meta?.meta?.dataQuality || meta || {};
  const overallN = dq?.overallN ?? dq?.n ?? null;
  const weeksCoverage = dq?.weeksCoverage ?? dq?.weeks ?? null;

  if (typeof overallN === "number" && overallN >= 200 && typeof weeksCoverage === "number" && weeksCoverage >= 12) return "high";
  if (typeof overallN === "number" && overallN >= 60 && typeof weeksCoverage === "number" && weeksCoverage >= 6) return "med";
  return "low";
}

function decisionTheme(decisionUpper) {
  const d = String(decisionUpper || "INFO").toUpperCase();
  if (d === "ALERT") return { key: "alert", color: "var(--alert)" };
  if (d === "WATCH") return { key: "watch", color: "var(--watch)" };
  return { key: "info", color: "var(--info)" };
}

/* =========================
   ✅ UI Decision Logic
   ✅ IMPORTANT CHANGE:
   - We now "lock" UI status to REPORT consensus if available
   - because report & run must never contradict.
   ========================= */
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

  // extra guard: single-method alert => show WATCH
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
   ✅ Page
   ========================= */
export default function SurveillanceDashboard({ lang = "en" }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);
  const isRTL = lang === "ar";

  const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:4000";

  // ✅ Scope
  const [scopeMode, setScopeMode] = useState("global");
  const [facilityId, setFacilityId] = useState("");
  const [regionId, setRegionId] = useState("");

  // ✅ Test selection
  const [testCode, setTestCode] = useState("HB");
  const derivedSignal = useMemo(() => getSignalForTest(testCode), [testCode]);
  const derivedSignalLabel = useMemo(() => getSignalLabel(t, derivedSignal), [t, derivedSignal]);

  // ✅ Methods
  const [methods, setMethods] = useState({ ewma: true, cusum: true, farrington: true });

  // ✅ Time filter + preset
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preset, setPreset] = useState("standard");

  // ✅ Advanced
  const [advanced, setAdvanced] = useState(false);

  const [ewmaLambda, setEwmaLambda] = useState(PRESETS.standard.ewma.lambda);
  const [ewmaL, setEwmaL] = useState(PRESETS.standard.ewma.L);
  const [ewmaBaselineN, setEwmaBaselineN] = useState(PRESETS.standard.ewma.baselineN);

  const [cusumBaselineN, setCusumBaselineN] = useState(PRESETS.standard.cusum.baselineN);
  const [cusumK, setCusumK] = useState(PRESETS.standard.cusum.k);
  const [cusumH, setCusumH] = useState(PRESETS.standard.cusum.h);

  const [farringtonBaselineWeeks, setFarringtonBaselineWeeks] = useState(PRESETS.standard.farrington.baselineWeeks);
  const [farringtonZ, setFarringtonZ] = useState(PRESETS.standard.farrington.z);

  useEffect(() => {
    if (advanced) return;
    const p = PRESETS[preset] || PRESETS.standard;

    setEwmaLambda(p.ewma.lambda);
    setEwmaL(p.ewma.L);
    setEwmaBaselineN(p.ewma.baselineN);

    setCusumBaselineN(p.cusum.baselineN);
    setCusumK(p.cusum.k);
    setCusumH(p.cusum.h);

    setFarringtonBaselineWeeks(p.farrington.baselineWeeks);
    setFarringtonZ(p.farrington.z);
  }, [preset, advanced]);

  const [loading, setLoading] = useState(false);
  const [runData, setRunData] = useState(null);
  const [reportText, setReportText] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataRange, setDataRange] = useState(null);

  // Charts payload from RUN
  const [chartsPayload, setChartsPayload] = useState(null);

  // ✅ Upload state
  const [lastUpload, setLastUpload] = useState(null);

  // technical details collapsed by default
  const [showDetails, setShowDetails] = useState(false);

  // ✅ Uploads report UI state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportErr, setReportErr] = useState("");
  const [reportData, setReportData] = useState(null);

  const abortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      try {
        const j = await fetchJSON(`${apiBase}/health`);
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

    if (advanced) {
      params.set("advanced", "1");

      params.set("ewmaLambda", String(clampNum(ewmaLambda, BOUNDS.ewma.lambda.min, BOUNDS.ewma.lambda.max)));
      params.set("ewmaL", String(clampNum(ewmaL, BOUNDS.ewma.L.min, BOUNDS.ewma.L.max)));
      params.set(
        "ewmaBaselineN",
        String(clampInt(ewmaBaselineN, BOUNDS.ewma.baselineN.min, BOUNDS.ewma.baselineN.max))
      );

      params.set(
        "cusumBaselineN",
        String(clampInt(cusumBaselineN, BOUNDS.cusum.baselineN.min, BOUNDS.cusum.baselineN.max))
      );
      params.set("cusumK", String(clampNum(cusumK, BOUNDS.cusum.k.min, BOUNDS.cusum.k.max)));
      params.set("cusumH", String(clampNum(cusumH, BOUNDS.cusum.h.min, BOUNDS.cusum.h.max)));

      params.set(
        "farringtonBaselineWeeks",
        String(clampInt(farringtonBaselineWeeks, BOUNDS.farrington.baselineWeeks.min, BOUNDS.farrington.baselineWeeks.max))
      );
      params.set("farringtonZ", String(clampNum(farringtonZ, BOUNDS.farrington.z.min, BOUNDS.farrington.z.max)));
    }

    return params;
  }

  function scopeLabel() {
    if (scopeMode === "global") return t.modeGlobal;

    const core =
      scopeMode === "facility"
        ? `${t.modeFacility}: ${facilityId?.trim() || t.notAvailable}`
        : `${t.modeRegion}: ${regionId?.trim() || t.notAvailable}`;

    return core;
  }

  /* ======================================================
     ✅ RUN (fixed)
     ✅ What we changed to kill contradictions permanently:
     1) Always send EXACT same params to run/report (scopeParams)
     2) Add cache-bust param _ts for report
     3) Force UI to use report.meta.consensus as "source of truth"
        -> overwrites runData.consensus if report provides it
     ====================================================== */
  async function runAnalysis() {
    const m = selectedMethods();
    if (!m.length) return;

    if (scopeMode === "facility" && !facilityId.trim()) {
      setErrMsg(t.requiredFacility);
      return;
    }
    if (scopeMode === "region" && !regionId.trim()) {
      setErrMsg(t.requiredRegion);
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

      // ---------- RUN ----------
      const runParams = new URLSearchParams(scopeParams);
      runParams.set("signal", derivedSignal);
      runParams.set("methods", m.join(","));
      runParams.set("testCode", String(testCode));
      runParams.set("lang", "both");

      const runJ = await fetchJSON(`${apiBase}/api/analytics/run?${runParams.toString()}`, controller.signal);
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

      // cache bust to avoid "looks like deploy didn't work"
      reportParams.set("_ts", String(Date.now()));

      const repJ = await fetchJSON(`${apiBase}/api/analytics/report?${reportParams.toString()}`, controller.signal);

      // ✅ Get report text
      const extracted = extractReport(repJ?.data?.report, lang);
      const finalReport = (extracted?.trim() ? extracted : "").trim();
      setReportText(finalReport || t.insufficient);

      // ✅ HARD FIX: source-of-truth consensus from REPORT meta
      const repConsensus = repJ?.data?.meta?.consensus || repJ?.data?.meta?.meta?.consensus || null;
      if (repConsensus) {
        setRunData((prev) => {
          if (!prev) return prev;
          return { ...prev, consensus: repConsensus };
        });
      }

      // health timestamp (optional)
      try {
        const hj = await fetchJSON(`${apiBase}/health`, controller.signal);
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

  function resetAdvancedToPreset() {
    const p = PRESETS[preset] || PRESETS.standard;

    setEwmaLambda(p.ewma.lambda);
    setEwmaL(p.ewma.L);
    setEwmaBaselineN(p.ewma.baselineN);

    setCusumBaselineN(p.cusum.baselineN);
    setCusumK(p.cusum.k);
    setCusumH(p.cusum.h);

    setFarringtonBaselineWeeks(p.farrington.baselineWeeks);
    setFarringtonZ(p.farrington.z);
  }

  // ✅ Reset: يرجع الصفحة لوضع "قبل Run"
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

  // ✅ Uploads report loader
  async function loadUploadsReport() {
  setReportLoading(true);
  setReportErr("");
  try {
    // ✅ Correct route based on your API "known" list
    const j = await fetchJSON(`${apiBase}/api/report/uploads?ts=${Date.now()}`);
    setReportData(j?.data || null);
    setReportOpen(true);
  } catch (e) {
    setReportErr(String(e?.message || e));
    setReportData(null);
    setReportOpen(true);
  } finally {
    setReportLoading(false);
  }
}


  // ✅ Derived view model (only after runData exists)
  const consensus = runData?.consensus;

  // ✅ القرار الذي سيظهر في UI
  const uiDecision = computeUiDecision(runData); // "info" | "watch" | "alert"
  const decision = upper(uiDecision); // "INFO" | "WATCH" | "ALERT"

  const theme = decisionTheme(decision);
  const decisionKey = theme.key;

  // ✅ أسماء الطرق التي أعطت Alert فعلاً
  const methodAlerts = listMethodAlerts(runData);

  const weekly = runData?.meta?.weekly || runData?.meta?.meta?.weekly || runData?.weekly || null;

  const trendKey = computeTrendFromWeekly(weekly);
  const confidenceKey = computeConfidence(runData?.meta || runData?.meta?.meta || runData?.meta);

  const trendLabel =
    trendKey === "up" ? t.trendUp : trendKey === "down" ? t.trendDown : trendKey === "flat" ? t.trendFlat : t.trendNoData;

  const confLabel = confidenceKey === "high" ? t.confHigh : confidenceKey === "med" ? t.confMed : t.confLow;

  const statusLabel = decision === "ALERT" ? t.alert : decision === "WATCH" ? t.watch : t.info;

  const trustMethods = methodsLabel(selectedMethods());

  // ✅ dataset derived from lastUpload
  const dataset = lastUpload?.ok ? t.uploadOk : t.notAvailable;

  const ewCfg = adaptEWMA(chartsPayload?.ewma);
  const cuCfg = adaptCUSUM(chartsPayload?.cusum);
  const faCfg = adaptFarrington(chartsPayload?.farrington);

  const presetLabel = preset === "low" ? t.presetLow : preset === "high" ? t.presetHigh : t.presetStandard;

  const canRunNow = !loading;

  // stratification
  const profile = runData?.profile || null;
  const profileInsight = runData?.profileInsight || null;

  const insightText =
    lang === "ar"
      ? profileInsight?.ar?.keyFinding || profileInsight?.ar?.summary || ""
      : profileInsight?.en?.keyFinding || profileInsight?.en?.summary || "";

  const overallN = profile?.overall?.n ?? 0;
  const overallRate = pickRate(profile?.overall);
  const overallCases = pickCases(profile?.overall);

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

        {/* Initiative + Disclaimer */}
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

        {/* ✅ Upload (ONE professional place) */}
        <div style={{ marginTop: 14 }}>
          <UploadCsv
            lang={lang}
            onUploaded={(payload) => {
              setLastUpload(payload);

              const dr = payload?.dateRange;
              if (dr?.start || dr?.end) setDataRange(dr);

              fetchJSON(`${apiBase}/health`)
                .then((hj) => setLastUpdated(hj?.time || hj?.timestamp || null))
                .catch(() => {});
            }}
          />
        </div>

        {/* Scope */}
        <div className="formRow" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t.scope}</label>
            <Dropdown dir={isRTL ? "rtl" : "ltr"} value={scopeMode} onChange={(v) => setScopeMode(v)} options={getScopeOptions(t)} />
          </div>

          {/* ✅ Reports button here */}
          <div className="actions" style={{ alignSelf: "end" }}>
            <button type="button" className="ghostBtn" onClick={loadUploadsReport} disabled={reportLoading}>
              {reportLoading ? "..." : lang === "ar" ? "تقرير الرفعات" : "Uploads Report"}
            </button>
          </div>
        </div>

        {/* Facility/Region + Test */}
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

        {/* Signal (auto) + note */}
        <div className="formRow">
          <div className="field">
            <label>{t.signal}</label>
            <input value={derivedSignalLabel} readOnly />
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

        {/* Time filter + Preset */}
        <div className="formRow">
          <div className="field">
            <label>{t.timeFilter}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{t.startDate}</div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{t.endDate}</div>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="ghostBtn"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
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
              onChange={(v) => setPreset(v)}
              options={[
                { value: "low", label: t.presetLow },
                { value: "standard", label: t.presetStandard },
                { value: "high", label: t.presetHigh },
              ]}
            />
            <div className="muted" style={{ marginTop: 8 }}>
              {lang === "ar" ? "Preset الحالي" : "Current preset"}: <span className="tinyPill">{presetLabel}</span> •{" "}
              {lang === "ar" ? "متقدمة" : "Advanced"}:{" "}
              <span className="tinyPill">{advanced ? (lang === "ar" ? "نعم" : "Yes") : lang === "ar" ? "لا" : "No"}</span>
            </div>
          </div>
        </div>

        {/* Advanced Panel */}
        <div
          className="advWrap"
          style={{
            borderRadius: 14,
            padding: 12,
            background: "rgba(0,0,0,0.16)",
            border: "1px solid rgba(255,255,255,0.10)",
            marginTop: 10,
          }}
        >
          <div className="advHeader" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="advTitle" style={{ fontWeight: 950 }}>
                {t.advanced}
              </div>
              <div className="muted">{t.advancedHint}</div>
            </div>

            <div className="actions">
              <button type="button" className="ghostBtn" onClick={() => setAdvanced((s) => !s)} disabled={loading}>
                {advanced ? t.advancedOff : t.advancedOn}
              </button>

              <button type="button" className="ghostBtn" onClick={resetAdvancedToPreset} disabled={loading}>
                {t.resetToPreset}
              </button>
            </div>
          </div>

          {advanced ? (
            <div
              className="advGrid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                gap: 10,
                marginTop: 10,
              }}
            >
              <div
                className="advCard"
                style={{
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div className="advCardTitle" style={{ fontWeight: 950, marginBottom: 8 }}>
                  {t.ewmaBlock}
                </div>
                <ParamSlider
                  name={t.paramLambda}
                  value={ewmaLambda}
                  min={BOUNDS.ewma.lambda.min}
                  max={BOUNDS.ewma.lambda.max}
                  step={0.01}
                  onChange={(v) => setEwmaLambda(clampNum(v, BOUNDS.ewma.lambda.min, BOUNDS.ewma.lambda.max))}
                  hint={t.hintLambda}
                />
                <ParamSlider
                  name={t.paramL}
                  value={ewmaL}
                  min={BOUNDS.ewma.L.min}
                  max={BOUNDS.ewma.L.max}
                  step={0.1}
                  onChange={(v) => setEwmaL(clampNum(v, BOUNDS.ewma.L.min, BOUNDS.ewma.L.max))}
                  hint={t.hintL}
                />
                <ParamSlider
                  name={t.paramEwmaBaselineN}
                  value={ewmaBaselineN}
                  min={BOUNDS.ewma.baselineN.min}
                  max={BOUNDS.ewma.baselineN.max}
                  step={1}
                  onChange={(v) => setEwmaBaselineN(clampInt(v, BOUNDS.ewma.baselineN.min, BOUNDS.ewma.baselineN.max))}
                  hint={t.hintBaselineN}
                />
              </div>

              <div
                className="advCard"
                style={{
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div className="advCardTitle" style={{ fontWeight: 950, marginBottom: 8 }}>
                  {t.cusumBlock}
                </div>
                <ParamSlider
                  name={t.paramCusumBaselineN}
                  value={cusumBaselineN}
                  min={BOUNDS.cusum.baselineN.min}
                  max={BOUNDS.cusum.baselineN.max}
                  step={1}
                  onChange={(v) => setCusumBaselineN(clampInt(v, BOUNDS.cusum.baselineN.min, BOUNDS.cusum.baselineN.max))}
                  hint={t.hintBaselineN}
                />
                <ParamSlider
                  name={t.paramK}
                  value={cusumK}
                  min={BOUNDS.cusum.k.min}
                  max={BOUNDS.cusum.k.max}
                  step={0.01}
                  onChange={(v) => setCusumK(clampNum(v, BOUNDS.cusum.k.min, BOUNDS.cusum.k.max))}
                  hint={t.hintK}
                />
                <ParamSlider
                  name={t.paramH}
                  value={cusumH}
                  min={BOUNDS.cusum.h.min}
                  max={BOUNDS.cusum.h.max}
                  step={0.1}
                  onChange={(v) => setCusumH(clampNum(v, BOUNDS.cusum.h.min, BOUNDS.cusum.h.max))}
                  hint={t.hintH}
                />
              </div>

              <div
                className="advCard"
                style={{
                  borderRadius: 14,
                  padding: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div className="advCardTitle" style={{ fontWeight: 950, marginBottom: 8 }}>
                  {t.farringtonBlock}
                </div>
                <ParamSlider
                  name={t.paramFarrBaseline}
                  value={farringtonBaselineWeeks}
                  min={BOUNDS.farrington.baselineWeeks.min}
                  max={BOUNDS.farrington.baselineWeeks.max}
                  step={1}
                  onChange={(v) => setFarringtonBaselineWeeks(clampInt(v, BOUNDS.farrington.baselineWeeks.min, BOUNDS.farrington.baselineWeeks.max))}
                  hint={t.hintFarrBaseline}
                />
                <ParamSlider
                  name={t.paramZ}
                  value={farringtonZ}
                  min={BOUNDS.farrington.z.min}
                  max={BOUNDS.farrington.z.max}
                  step={0.05}
                  onChange={(v) => setFarringtonZ(clampNum(v, BOUNDS.farrington.z.min, BOUNDS.farrington.z.max))}
                  hint={t.hintZ}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Methods + Actions */}
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
              <button
                type="button"
                className={`chipBtn ${methods.farrington ? "chipBtnOn" : ""}`}
                onClick={() => toggleMethod("farrington")}
              >
                Farrington
              </button>
            </div>
          </div>

          <div className="actions">
            <button
              type="button"
              className="dangerBtn"
              onClick={() => {
                setPreset("high");
                setAdvanced(false);
              }}
              disabled={loading}
            >
              {t.quickHigh}
            </button>

            <button type="button" className="primaryBtn" onClick={runAnalysis} disabled={!canRunNow}>
              {loading ? "…" : t.run}
            </button>

            <button type="button" className="ghostBtn" onClick={resetRun} disabled={loading && !runData}>
              Reset
            </button>

            <button type="button" className="ghostBtn" onClick={copyReport} disabled={!reportText || loading}>
              {copied ? t.copied : t.report}
            </button>
          </div>
        </div>

        {/* Errors */}
        {errMsg ? (
          <div className="muted" style={{ marginTop: 10 }}>
            {t.error} {safeText(errMsg)}
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ghostBtn" onClick={runAnalysis}>
                {t.retry}
              </button>
            </div>
          </div>
        ) : null}

        {/* Trust / metadata */}
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

      {/* ✅ النتائج مخفية بالكامل قبل Run */}
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

                  {/* ✅ explain single-method alerts */}
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

          {/* Technical details are hidden by default */}
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

              {/* Population Stratification */}
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
                      <StratCard
                        title={t.byNationality}
                        items={profile?.byNationality || []}
                        getKey={(it) => safeLabel(it?.nationality)}
                        t={t}
                      />
                    </div>

                    {insightText ? (
                      <div
                        className="reportBox2"
                        style={{ padding: 12, borderRadius: 12, whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                        dir={isRTL ? "rtl" : "ltr"}
                      >
                        {insightText}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Narrative report */}
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

      {/* ✅ Uploads Report Modal */}
      {reportOpen ? (
        <div className="modalOverlay" onMouseDown={() => setReportOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="modalTitle">{lang === "ar" ? "تقرير الرفعات" : "Uploads Report"}</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {lang === "ar" ? "ملخص الملفات والمرافق والمناطق وعدد الفحوصات حسب كل فحص." : "Summary of uploads, facilities, regions, and counts per test."}
                </div>
              </div>
              <button className="ghostBtn" onClick={() => setReportOpen(false)}>
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>

            <div className="modalBody">
              {reportErr ? <div className="muted">{reportErr}</div> : null}

              {!reportErr && !reportData ? <div className="muted">{lang === "ar" ? "لا توجد بيانات." : "No data."}</div> : null}

              {reportData?.totals ? (
                <div className="mini" style={{ marginBottom: 12 }}>
                  <div className="miniRow">
                    <div className="miniKey">{lang === "ar" ? "عدد الملفات" : "Files"}</div>
                    <div className="miniVal">{reportData.totals.files}</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniKey">{lang === "ar" ? "إجمالي الفحوصات" : "Total tests"}</div>
                    <div className="miniVal">{reportData.totals.tests}</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniKey">{lang === "ar" ? "عدد المرافق" : "Facilities"}</div>
                    <div className="miniVal">{reportData.totals.facilities}</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniKey">{lang === "ar" ? "عدد المناطق" : "Regions"}</div>
                    <div className="miniVal">{reportData.totals.regions}</div>
                  </div>
                </div>
              ) : null}

              {Array.isArray(reportData?.byTest) && reportData.byTest.length ? (
                <>
                  <div className="cardTitle" style={{ marginBottom: 8 }}>
                    {lang === "ar" ? "حسب الفحص" : "By test"}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === "ar" ? "الفحص" : "Test"}</th>
                        <th>{lang === "ar" ? "العدد" : "Count"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byTest.slice(0, 200).map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.testCode}</td>
                          <td>{r.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              <div style={{ height: 12 }} />

              {Array.isArray(reportData?.facilities) && reportData.facilities.length ? (
                <>
                  <div className="cardTitle" style={{ marginBottom: 8 }}>
                    {lang === "ar" ? "المرافق" : "Facilities"}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === "ar" ? "رمز المرفق" : "Facility ID"}</th>
                        <th>{lang === "ar" ? "اسم المرفق" : "Facility name"}</th>
                        <th>{lang === "ar" ? "عدد الفحوصات" : "Tests"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.facilities.slice(0, 200).map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.facilityId}</td>
                          <td>{r.facilityName || "—"}</td>
                          <td>{r.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              <div style={{ height: 12 }} />

              {Array.isArray(reportData?.regions) && reportData.regions.length ? (
                <>
                  <div className="cardTitle" style={{ marginBottom: 8 }}>
                    {lang === "ar" ? "المناطق" : "Regions"}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === "ar" ? "رمز المنطقة" : "Region ID"}</th>
                        <th>{lang === "ar" ? "اسم المنطقة" : "Region name"}</th>
                        <th>{lang === "ar" ? "عدد الفحوصات" : "Tests"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.regions.slice(0, 200).map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.regionId}</td>
                          <td>{r.regionName || "—"}</td>
                          <td>{r.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <footer className="footer">
        <div>{t.footerLine1}</div>
        <div>{t.footerLine2}</div>
        <div style={{ opacity: 0.85 }}>{t.footerLine3}</div>
      </footer>
    </div>
  );
}