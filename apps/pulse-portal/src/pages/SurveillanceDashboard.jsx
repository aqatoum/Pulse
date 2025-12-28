// apps/pulse-portal/src/pages/SurveillanceDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import DecisionCard from "../components/DecisionCard.jsx";
import SimpleSeriesChart from "../components/SimpleSeriesChart.jsx";
import UploadCsv from "../components/UploadCsv.jsx";
import MethodStatusBanner from "../components/MethodStatusBanner.jsx";

import {
  TXT,
  PRESETS,
  getScopeOptions,
  getTestOptions,
  getSignalForTest,
  getSignalLabel,
  upper,
  safeText,
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
} from "./surveillance/index.js";

/* =========================
   ✅ Light Medical Theme (Blue)
   ========================= */
const styles = `
  :root{
    --bg: #F4F8FF;
    --bg2: #EEF5FF;
    --card: #FFFFFF;
    --card2: rgba(11, 87, 208, 0.04);
    --stroke: rgba(11, 87, 208, 0.12);
    --stroke2: rgba(11, 87, 208, 0.16);

    --text: rgba(10, 20, 40, 0.92);
    --muted: rgba(10, 20, 40, 0.70);

    --info: #1D4ED8;
    --watch: #F59E0B;
    --alert: #EF4444;

    --ink: rgba(10, 20, 40, 0.92);
    --shadow: 0 18px 40px rgba(11, 87, 208, 0.10);
  }

  .dash{
    min-height: 100vh;
    padding: 18px;
    display: grid;
    gap: 14px;
    background:
      radial-gradient(900px 600px at 10% 10%, rgba(29,78,216,0.12), transparent 55%),
      radial-gradient(900px 600px at 80% 15%, rgba(59,130,246,0.10), transparent 55%),
      linear-gradient(180deg, var(--bg), var(--bg2));
    color: var(--text);
  }

  .panel{
    border-radius: 18px;
    padding: 16px;
    background: var(--card);
    border: 1px solid var(--stroke);
    box-shadow: var(--shadow);
  }

  .panelHeader{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .titleWrap{ display:grid; gap: 6px; }
  .panelTitle{
    font-weight: 950;
    font-size: 20px;
    letter-spacing: .2px;
    color: var(--ink);
  }
  .panelSub{
    opacity: .90;
    font-size: 13px;
    line-height: 1.6;
    max-width: 980px;
    color: var(--muted);
  }
  .panelHint{
    opacity:.80;
    font-size: 12px;
    line-height: 1.6;
    max-width: 980px;
    color: var(--muted);
  }

  .infoGrid{
    display:grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 12px;
    margin-top: 10px;
  }
  .infoCard{
    border-radius: 16px;
    padding: 14px;
    background: var(--card2);
    border: 1px solid var(--stroke);
  }
  .infoCardTitle{ font-weight: 950; margin-bottom: 6px; color: var(--ink); }
  .infoCardBody{ opacity: .90; font-size: 13px; line-height: 1.7; color: var(--muted); }

  .formRow{
    display:grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 12px;
    margin-bottom: 10px;
  }
  .field label{ display:block; font-size: 12px; opacity:.85; margin-bottom: 6px; color: var(--muted); }
  .field input{
    width:100%;
    border-radius: 12px;
    border: 1px solid var(--stroke2);
    background: #fff;
    color: var(--ink);
    padding: 10px 12px;
    outline:none;
  }
  .field input:focus{
    border-color: rgba(29,78,216,0.35);
    box-shadow: 0 0 0 3px rgba(29,78,216,0.10);
  }

  .actions{
    display:flex;
    gap: 10px;
    align-items:center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .primaryBtn{
    border:0;
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 950;
    cursor:pointer;
    background: rgba(29,78,216,0.95);
    color: white;
    box-shadow: 0 10px 20px rgba(29,78,216,0.18);
  }
  .primaryBtn:hover{ filter: brightness(1.02); }
  .primaryBtn:disabled{ opacity:.6; cursor:not-allowed; }

  .ghostBtn{
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 950;
    cursor:pointer;
    background: rgba(29,78,216,0.06);
    color: var(--ink);
    border: 1px solid var(--stroke2);
  }
  .ghostBtn:hover{ border-color: rgba(29,78,216,0.28); }
  .ghostBtn:disabled{ opacity:.55; cursor:not-allowed; }

  .dangerBtn{
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 950;
    cursor:pointer;
    background: rgba(245, 158, 11, 0.12);
    color: rgba(10, 20, 40, 0.92);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .miniGrid{
    display:grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
    margin-top: 10px;
  }
  .mini{
    border-radius: 14px;
    padding: 10px 12px;
    background: rgba(29,78,216,0.04);
    border: 1px solid var(--stroke);
  }
  .miniRow{
    display:flex;
    justify-content:space-between;
    gap: 10px;
    font-size: 12px;
    line-height: 1.6;
  }
  .miniKey{ opacity:.78; color: var(--muted); }
  .miniVal{ font-weight: 900; opacity:.95; text-align: end; color: var(--ink); }

  .grid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
  .card{
    border-radius: 18px;
    padding: 16px;
    background: var(--card);
    border: 1px solid var(--stroke);
    box-shadow: var(--shadow);
  }
  .cardWide{ grid-column: 1 / -1; }
  .cardHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom: 10px; }
  .cardTitle{ font-weight: 950; letter-spacing: .2px; color: var(--ink); }

  .muted{ opacity:.88; font-size: 13px; line-height: 1.75; color: var(--muted); }

  .tinyPill{
    display:inline-flex;
    align-items:center;
    gap:6px;
    border-radius: 999px;
    padding: 6px 10px;
    border: 1px solid var(--stroke);
    background: rgba(29,78,216,0.06);
    font-weight: 900;
    font-size: 12px;
    color: var(--ink);
  }

  .statusCard{
    border-radius: 20px;
    padding: 18px;
    background: #ffffff;
    border: 1px solid var(--stroke);
    box-shadow: var(--shadow);
    overflow:hidden;
    position: relative;
  }
  .statusGlow{
    position:absolute; inset: -80px;
    filter: blur(28px);
    opacity: 0.85;
    pointer-events:none;
  }
  .statusTop{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap: 12px;
    position: relative;
  }
  .statusTitle{ font-weight: 950; font-size: 16px; opacity: .95; color: var(--ink); }
  .statusBadge{
    display:inline-flex;
    align-items:center;
    gap: 8px;
    border-radius: 999px;
    padding: 8px 12px;
    font-weight: 950;
    border: 1px solid var(--stroke);
    background: rgba(29,78,216,0.06);
    color: var(--ink);
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
    color: var(--ink);
  }
  .statusMeta{ display:grid; gap: 8px; }
  .kv{ display:flex; justify-content:space-between; gap: 10px; font-size: 13px; }
  .k{ opacity: .78; color: var(--muted); }
  .v{ font-weight: 900; opacity: .95; text-align:end; color: var(--ink); }

  .statusText{
    margin-top: 12px;
    border-radius: 14px;
    padding: 12px;
    background: rgba(29,78,216,0.04);
    border: 1px solid var(--stroke);
    font-size: 13px;
    line-height: 1.8;
    position: relative;
    color: var(--ink);
  }
  .statusText b{ font-weight: 950; }

  .linkBtn{
    border-radius: 12px;
    padding: 10px 14px;
    font-weight: 950;
    cursor:pointer;
    background: rgba(29,78,216,0.06);
    color: var(--ink);
    border: 1px solid var(--stroke2);
  }
  .linkBtn:hover{ border-color: rgba(29,78,216,0.28); }

  /* Stratification */
  .stratGrid{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
  .stratCard{
    border-radius: 16px;
    padding: 12px;
    background: rgba(29,78,216,0.04);
    border: 1px solid var(--stroke);
    overflow:hidden;
  }
  .stratTitle{ font-weight: 950; margin-bottom: 10px; display:flex; justify-content:space-between; gap: 10px; color: var(--ink); }
  .stratMeta{ opacity:.80; font-size: 12px; color: var(--muted); }
  .row{
    display:grid;
    grid-template-columns: 1.2fr .6fr .8fr;
    gap: 10px;
    align-items:center;
    margin-bottom: 8px;
  }
  .rowLabel{ font-weight: 900; opacity:.92; color: var(--ink); }
  .rowCount{ opacity:.88; font-size: 12px; text-align:end; color: var(--muted); }
  .rowPct{ font-weight: 950; text-align:end; color: var(--ink); }
  .bar{
    margin-top: 6px;
    height: 8px;
    border-radius: 999px;
    background: rgba(29,78,216,0.08);
    border: 1px solid rgba(29,78,216,0.10);
    overflow:hidden;
  }
  .fill{
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(29,78,216,0.95), rgba(59,130,246,0.92));
  }

  .reportBox2{
    background: rgba(29,78,216,0.04);
    border: 1px solid var(--stroke);
    color: var(--ink);
  }

  /* Modal */
  .modalOverlay{
    position: fixed;
    inset: 0;
    background: rgba(10,20,40,0.35);
    backdrop-filter: blur(8px);
    display:flex;
    align-items:center;
    justify-content:center;
    padding: 16px;
    z-index: 9999;
  }
  .modal{
    width: min(980px, 100%);
    border-radius: 18px;
    background: #ffffff;
    border: 1px solid var(--stroke);
    box-shadow: var(--shadow);
    overflow:hidden;
  }
  .modalHeader{
    display:flex;
    justify-content:space-between;
    gap: 10px;
    align-items:flex-start;
    padding: 14px 16px;
    border-bottom: 1px solid var(--stroke);
  }
  .modalTitle{ font-weight: 950; color: var(--ink); }
  .modalBody{ padding: 14px 16px; }
  .table{
    width: 100%;
    border-collapse: collapse;
    overflow:hidden;
    border-radius: 12px;
    border: 1px solid var(--stroke);
    background: #fff;
  }
  .table th, .table td{
    padding: 10px 10px;
    border-bottom: 1px solid rgba(11,87,208,0.10);
    font-size: 12px;
    text-align: start;
    vertical-align: top;
    color: var(--ink);
  }
  .table th{
    font-weight: 950;
    background: rgba(29,78,216,0.05);
  }
  .table tr:last-child td{ border-bottom: 0; }

  .footer{
    margin-top: 4px;
    border-radius: 18px;
    padding: 14px 16px;
    background: rgba(29,78,216,0.04);
    border: 1px solid var(--stroke);
    opacity: .92;
    font-size: 12px;
    line-height: 1.7;
    text-align: center;
    color: var(--muted);
    box-shadow: var(--shadow);
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
    background: rgba(29,78,216,0.06);
    border: 1px solid var(--stroke2);
    color: var(--ink);
    font-weight: 950;
    cursor: pointer;
    font-size: 12px;
  }
  .chipBtnOn{
    background: rgba(29,78,216,0.12);
    border-color: rgba(29,78,216,0.28);
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

  // ✅ Time filter + preset only (NO advanced)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preset, setPreset] = useState("standard");

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
     ✅ RUN
     - no advanced params anymore
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
      reportParams.set("_ts", String(Date.now()));

      const repJ = await fetchJSON(`${apiBase}/api/analytics/report?${reportParams.toString()}`, controller.signal);

      const extracted = extractReport(repJ?.data?.report, lang);
      const finalReport = (extracted?.trim() ? extracted : "").trim();
      setReportText(finalReport || t.insufficient);

      // ✅ source-of-truth consensus from REPORT meta
      const repConsensus = repJ?.data?.meta?.consensus || repJ?.data?.meta?.meta?.consensus || null;
      if (repConsensus) {
        setRunData((prev) => {
          if (!prev) return prev;
          return { ...prev, consensus: repConsensus };
        });
      }

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

  async function loadUploadsReport() {
    setReportLoading(true);
    setReportErr("");
    try {
      const j = await fetchJSON(`${apiBase}/api/upload/report`);
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

  const uiDecision = computeUiDecision(runData);
  const decision = upper(uiDecision);
  const theme = decisionTheme(decision);
  const decisionKey = theme.key;

  const methodAlerts = listMethodAlerts(runData);
  const weekly = runData?.meta?.weekly || runData?.meta?.meta?.weekly || runData?.weekly || null;

  const trendKey = computeTrendFromWeekly(weekly);
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
  const canRunNow = !loading;

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
        ? "إشارة تستدعي المراقبة: يوجد تنبيه من طريقة واحدة أو أكثر. يُنصح بالمتابعة القريبة خلال الفترة القادمة ومقارنة النطاق عند توفر بيانات أكثر."
        : "Monitoring signal: one or more methods triggered an alert. Follow closely and compare scope as more data arrive.";
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

        {/* ✅ Upload */}
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

        {/* Scope + Uploads report */}
        <div className="formRow" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t.scope}</label>
            <Dropdown dir={isRTL ? "rtl" : "ltr"} value={scopeMode} onChange={(v) => setScopeMode(v)} options={getScopeOptions(t)} />
          </div>

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

        {/* Signal + hint */}
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
                border: "1px solid rgba(11,87,208,0.12)",
                background: "rgba(29,78,216,0.04)",
                fontSize: 12,
              }}
            >
              <b>{t.analysisNoteTitle}:</b> {t.analysisNoteBody}
            </div>
          </div>
        </div>

        {/* Time filter + Preset (only) */}
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
              {lang === "ar" ? "الحساسية الحالية" : "Current sensitivity"}: <span className="tinyPill">{presetLabel}</span>
            </div>

            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              {lang === "ar"
                ? "ملاحظة: تم تبسيط الصفحة بإزالة الإعدادات المتقدمة لضمان سهولة الاستخدام."
                : "Note: Advanced tuning was removed to keep the UI clean and easy."}
            </div>
          </div>
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
              onClick={() => setPreset("high")}
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
              <div className="miniVal">{methodsLabel(selectedMethods())}</div>
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
          <div className="card cardWide" style={{ padding: 0, background: "transparent", border: "0", boxShadow: "none" }}>
            <div className="statusCard">
              <div
                className="statusGlow"
                style={{
                  background:
                    decisionKey === "alert"
                      ? "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.20), transparent 55%)"
                      : decisionKey === "watch"
                      ? "radial-gradient(circle at 30% 30%, rgba(245,158,11,0.18), transparent 55%)"
                      : "radial-gradient(circle at 30% 30%, rgba(29,78,216,0.18), transparent 55%)",
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
                      boxShadow: `0 0 0 6px rgba(29,78,216,0.08)`,
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
                    <div className="v">{methodsLabel(selectedMethods())}</div>
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

          {/* Details */}
          {showDetails ? (
            <>
              <div className="card cardWide">
                <div className="cardHeader">
                  <div className="cardTitle">{t.chartsTitle}</div>
                </div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  {t.chartsHint}
                </div>

                {/* ✅ Show data sufficiency warnings per method (if backend includes it) */}
                <div style={{ marginBottom: 10 }}>
                  {methods.ewma ? (
                    <MethodStatusBanner
                      title="EWMA"
                      status={
                        runData?.results?.ewma?.dataSufficiency ||
                        (runData?.results?.ewma?.points?.length ? { ok: true } : { ok: false, reason: "NO_POINTS" })
                      }
                      lang={lang}
                    />
                  ) : null}

                  {methods.cusum ? (
                    <MethodStatusBanner
                      title="CUSUM"
                      status={
                        runData?.results?.cusum?.dataSufficiency ||
                        (runData?.results?.cusum?.points?.length ? { ok: true } : { ok: false, reason: "NO_POINTS" })
                      }
                      lang={lang}
                    />
                  ) : null}

                  {methods.farrington ? (
                    <MethodStatusBanner
                      title="Farrington"
                      status={
                        runData?.results?.farrington?.dataSufficiency ||
                        (runData?.results?.farrington?.points?.length ? { ok: true } : { ok: false, reason: "NO_POINTS" })
                      }
                      lang={lang}
                    />
                  ) : null}
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
