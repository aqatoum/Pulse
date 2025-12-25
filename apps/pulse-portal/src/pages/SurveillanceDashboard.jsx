import React, { useEffect, useMemo, useRef, useState } from "react";
import DecisionCard from "../components/DecisionCard.jsx";
import SimpleSeriesChart from "../components/SimpleSeriesChart.jsx";

/* =========================
   ✅ Language Pack
   ========================= */
const TXT = {
  ar: {
    title: "لوحة المراقبة الوبائية",
    note: "نصيحة: استخدام أكثر من طريقة يعطي قرارًا أقوى. الحساسية الأعلى قد تلتقط تغيرات أسرع لكنها قد تزيد الإنذارات الكاذبة.",

    scope: "نطاق التحليل",
    modeGlobal: "وطني (كل البيانات)",
    modeFacility: "مرفق صحي",
    modeRegion: "منطقة",
    facility: "رمز المرفق",
    region: "رمز المنطقة",
    lab: "رمز المختبر (اختياري)",
    placeholderFacility: "مثال: AMM-NEWCAMP-01 (اختياري)",
    placeholderRegion: "مثال: AMMAN_SOUTH (اختياري)",
    placeholderLab: "مثال: LAB-01",

    test: "الفحص",
    hb: "Hb (فقر دم)",
    wbc: "WBC (كريات بيضاء)",
    crp: "CRP (التهاب)",
    plt: "PLT (صفائح)",

    signal: "الإشارة",
    signalHint: "الإشارة تُحدد تلقائيًا بناءً على الفحص المختار. (مثال: Hb ⇢ Anemia).",

    sigAnemia: "Anemia (Low Hb rate)",
    sigWbc: "WBC deviation (High WBC rate)",
    sigCrp: "Inflammation (High CRP rate)",
    sigPlt: "Platelets deviation (Low PLT rate)",

    analysisNoteTitle: "ملاحظة",
    analysisNoteBody: "سيتم تطبيق التحليل على الإشارة المختارة أعلاه.",

    methods: "الطرق الإحصائية",
    run: "تشغيل التحليل",
    report: "نسخ التقرير",
    copied: "تم النسخ ✅",

    dataset: "مصدر البيانات",
    aggregation: "التجميع",
    timeFilter: "فلتر الزمن",
    startDate: "بداية",
    endDate: "نهاية",
    clearDates: "مسح التواريخ",

    sensitivity: "الحساسية",
    presetLow: "منخفضة",
    presetStandard: "قياسية",
    presetHigh: "عالية",
    quickHigh: "رفع الحساسية (High)",

    advanced: "إعدادات متقدمة",
    advancedOn: "تفعيل الإعدادات المتقدمة",
    advancedOff: "إيقاف المتقدمة (رجوع للـ Preset)",
    advancedHint:
      "المتقدمة تسمح بضبط حساسية كل طريقة بشكل أدق. كل القيم هنا محكومة بحدود آمنة (Bounds) لمنع إعدادات غير منطقية.",
    ewmaBlock: "EWMA",
    cusumBlock: "CUSUM",
    farringtonBlock: "Farrington",
    paramLambda: "Lambda (EWMA)",
    paramL: "L (EWMA)",
    paramEwmaBaselineN: "Baseline weeks (EWMA)",
    paramCusumBaselineN: "Baseline weeks (CUSUM)",
    paramK: "k (CUSUM)",
    paramH: "h (CUSUM)",
    paramFarrBaseline: "Baseline weeks (Farrington)",
    paramZ: "z (Farrington)",
    resetToPreset: "إعادة ضبط لقيم الـ Preset",

    hintLambda: "Lambda أعلى = استجابة أسرع للتغيرات الحديثة (حساسية أعلى). أقل = سلاسة أكثر (حساسية أقل).",
    hintL: "L أكبر = حد أعلى أعلى (أقل حساسية). L أصغر = حد أقل (أكثر حساسية).",
    hintBaselineN: "Baseline أكبر = مرجع تاريخي أوسع (استقرار أعلى). أصغر = مرجع أقل (قد يزيد التذبذب).",
    hintK: "k أصغر = حساسية أكبر لتغيرات صغيرة. k أكبر = يتطلب تغير أكبر ليبدأ التراكم.",
    hintH: "h أصغر = إنذار أسرع (حساسية أعلى). h أكبر = يتطلب تراكم أكبر.",
    hintFarrBaseline: "BaselineWeeks أكبر = مقارنة مع تاريخ أطول. أصغر = استجابة أسرع لكن أقل ثباتًا.",
    hintZ: "z أصغر = حد أقل (حساسية أعلى). z أكبر = حد أعلى (حساسية أقل).",

    methodsUsed: "الطرق المستخدمة",
    lastUpdated: "آخر تحديث",
    notAvailable: "غير متاح",
    empty: "لا توجد بيانات بعد.",
    insufficient: "لا توجد بيانات كافية لإنشاء تقرير واضح ضمن النطاق المحدد.",

    uploadTitle: "رفع ملف CSV (نتائج مختبر)",
    upload: "رفع",
    uploading: "جاري الرفع…",
    uploadOk: "تم رفع الملف بنجاح",
    updatedWeeks: "أسابيع تم تحديثها",

    error: "تعذر تحميل البيانات حاليًا.",
    retry: "إعادة المحاولة",

    consensus: "قرار الإجماع",
    ensemble: "ملخص التجميع",
    watch: "مراقبة",
    alerts: "إنذار",
    interpretation: "التفسير",
    strat: "التقسيم السكاني",
    narrative: "التقرير السردي",

    infoTitle: "INFO",
    infoHint: "وصف علمي مختصر للنطاق والطرق وجودة البيانات وسبب إطلاق الإشارة.",

    chartsTitle: "الرسوم التوضيحية (لغير المختصين)",
    chartsHint:
      "الفكرة ببساطة: الخط يمثل تغير المؤشر عبر الزمن. الخط المتقطع هو الحد الذي عند تجاوزه تصبح الإشارة غير معتادة إحصائيًا. الدائرة الفارغة تعني نقطة إنذار.",

    presetActive: "Preset الحالي",
    advancedActive: "متقدمة",
    yes: "نعم",
    no: "لا",

    requiredFacility: "الرجاء إدخال رمز المرفق عند اختيار (مرفق صحي).",
    requiredRegion: "الرجاء إدخال رمز المنطقة عند اختيار (منطقة).",

    // ✅ strat labels
    totalSamples: "إجمالي العينات",
    signalRate: "معدل الإشارة",
    bySex: "حسب الجنس",
    byAge: "حسب العمر",
    byNationality: "حسب الجنسية",
  },

  en: {
    title: "Epidemiological Surveillance Dashboard",
    note:
      "Tip: using multiple methods strengthens the final decision. Higher sensitivity may detect changes earlier but can increase false alerts.",

    scope: "Scope",
    modeGlobal: "Global (all data)",
    modeFacility: "Facility",
    modeRegion: "Region",
    facility: "Facility code",
    region: "Region code",
    lab: "Lab code (optional)",
    placeholderFacility: "e.g., AMM-NEWCAMP-01 (optional)",
    placeholderRegion: "e.g., AMMAN_SOUTH (optional)",
    placeholderLab: "e.g., LAB-01",

    test: "Test",
    hb: "Hb (Anemia)",
    wbc: "WBC (White Blood Cells)",
    crp: "CRP (Inflammation)",
    plt: "PLT (Platelets)",

    signal: "Signal",
    signalHint: "Signal is auto-selected based on the chosen test (e.g., Hb ⇢ Anemia).",

    sigAnemia: "Anemia (Low Hb rate)",
    sigWbc: "WBC deviation (High WBC rate)",
    sigCrp: "Inflammation (High CRP rate)",
    sigPlt: "Platelets deviation (Low PLT rate)",

    analysisNoteTitle: "Note",
    analysisNoteBody: "Analysis will run on the selected signal above.",

    methods: "Statistical methods",
    run: "Run analysis",
    report: "Copy report",
    copied: "Copied ✅",

    dataset: "Dataset",
    aggregation: "Aggregation",
    timeFilter: "Time filter",
    startDate: "Start",
    endDate: "End",
    clearDates: "Clear dates",

    sensitivity: "Sensitivity",
    presetLow: "Low",
    presetStandard: "Standard",
    presetHigh: "High",
    quickHigh: "High sensitivity",

    advanced: "Advanced settings",
    advancedOn: "Enable advanced",
    advancedOff: "Disable advanced (use preset)",
    advancedHint: "Advanced lets you tune each method’s sensitivity. Values are clamped to safe bounds.",
    ewmaBlock: "EWMA",
    cusumBlock: "CUSUM",
    farringtonBlock: "Farrington",
    paramLambda: "Lambda (EWMA)",
    paramL: "L (EWMA)",
    paramEwmaBaselineN: "Baseline weeks (EWMA)",
    paramCusumBaselineN: "Baseline weeks (CUSUM)",
    paramK: "k (CUSUM)",
    paramH: "h (CUSUM)",
    paramFarrBaseline: "Baseline weeks (Farrington)",
    paramZ: "z (Farrington)",
    resetToPreset: "Reset to preset values",

    hintLambda:
      "Higher lambda reacts faster to recent changes (more sensitive). Lower is smoother (less sensitive).",
    hintL:
      "Higher L increases the control limit (less sensitive). Lower L makes alerts easier (more sensitive).",
    hintBaselineN:
      "Larger baseline means a more stable historical reference. Smaller may be noisier.",
    hintK:
      "Smaller k is more sensitive to small shifts. Larger k needs a bigger shift to accumulate.",
    hintH:
      "Smaller h triggers earlier (more sensitive). Larger h requires more accumulation.",
    hintFarrBaseline:
      "Larger baselineWeeks compares against longer history. Smaller reacts faster but less stable.",
    hintZ:
      "Smaller z lowers the threshold (more sensitive). Larger z raises it (less sensitive).",

    methodsUsed: "Methods used",
    lastUpdated: "Last updated",
    notAvailable: "N/A",
    empty: "No data yet.",
    insufficient: "Not enough data to generate a clear report within the selected scope.",

    uploadTitle: "Upload CSV (Lab Results)",
    upload: "Upload",
    uploading: "Uploading…",
    uploadOk: "Upload successful",
    updatedWeeks: "Weeks updated",

    error: "Unable to load data right now.",
    retry: "Retry",

    consensus: "Consensus decision",
    ensemble: "Ensemble summary",
    watch: "Watch",
    alerts: "Alert",
    interpretation: "Interpretation",
    strat: "Population stratification",
    narrative: "Narrative report",

    infoTitle: "INFO",
    infoHint: "A scientific snapshot of scope, methods, data quality, and why the signal was triggered.",

    chartsTitle: "Visual explanation (non-specialist friendly)",
    chartsHint:
      "Simply: the line shows how the indicator changes over time. The dashed line is the statistical threshold. Hollow circles mark alert points.",

    presetActive: "Current preset",
    advancedActive: "Advanced",
    yes: "Yes",
    no: "No",

    requiredFacility: "Please enter a facility code when Scope=Facility.",
    requiredRegion: "Please enter a region code when Scope=Region.",

    // ✅ strat labels
    totalSamples: "Total samples",
    signalRate: "Signal rate",
    bySex: "By sex",
    byAge: "By age",
    byNationality: "By nationality",
  },
};

/* =========================
   ✅ Options
   ========================= */
function getScopeOptions(t) {
  return [
    { value: "global", label: t.modeGlobal },
    { value: "facility", label: t.modeFacility },
    { value: "region", label: t.modeRegion },
  ];
}

function getTestOptions(t) {
  return [
    { value: "HB", label: t.hb },
    { value: "WBC", label: t.wbc },
    { value: "CRP", label: t.crp },
    { value: "PLT", label: t.plt },
  ];
}

function getSignalForTest(testCode) {
  if (testCode === "WBC") return "wbc";
  if (testCode === "CRP") return "crp";
  if (testCode === "PLT") return "plt";
  return "anemia";
}

function getSignalLabel(t, derivedSignal) {
  if (derivedSignal === "wbc") return t.sigWbc;
  if (derivedSignal === "crp") return t.sigCrp;
  if (derivedSignal === "plt") return t.sigPlt;
  return t.sigAnemia;
}

/* =========================
   ✅ Presets + Bounds (UI mirror of API)
   ========================= */
const PRESETS = {
  low: {
    ewma: { lambda: 0.2, L: 3.5, baselineN: 8 },
    cusum: { baselineN: 8, k: 0.7, h: 7.0 },
    farrington: { baselineWeeks: 12, z: 2.8 },
  },
  standard: {
    ewma: { lambda: 0.3, L: 3.0, baselineN: 4 },
    cusum: { baselineN: 4, k: 0.5, h: 5.0 },
    farrington: { baselineWeeks: 8, z: 2.0 },
  },
  high: {
    ewma: { lambda: 0.45, L: 2.4, baselineN: 4 },
    cusum: { baselineN: 4, k: 0.3, h: 3.5 },
    farrington: { baselineWeeks: 6, z: 1.8 },
  },
};

const BOUNDS = {
  ewma: { lambda: { min: 0.1, max: 0.5 }, L: { min: 2, max: 4 }, baselineN: { min: 4, max: 26 } },
  cusum: { baselineN: { min: 4, max: 26 }, k: { min: 0.1, max: 1.0 }, h: { min: 2, max: 10 } },
  farrington: { baselineWeeks: { min: 4, max: 26 }, z: { min: 1.5, max: 3.5 } },
};

/* =========================
   ✅ Styles
   ========================= */
const styles = `
  .dash{ padding: 18px; display: grid; gap: 14px; }
  .panel{
    border-radius: 16px; padding: 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
    backdrop-filter: blur(8px);
  }
  .panelHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; margin-bottom: 12px; }
  .panelTitle{ font-weight: 900; font-size: 18px; letter-spacing: .2px; }
  .panelHint{ opacity:.8; font-size: 12px; margin-top: 2px; max-width: 760px; line-height: 1.5; }

  .formRow{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; margin-bottom: 10px; }
  .field label{ display:block; font-size: 12px; opacity:.85; margin-bottom: 6px; }
  .field input{
    width:100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.22); color: rgba(255,255,255,0.92);
    padding: 10px 12px; outline:none;
  }
  .field input:focus{ border-color: rgba(255,255,255,0.28); box-shadow: 0 0 0 3px rgba(255,255,255,0.06); }

  .methodRow{ display:flex; align-items:flex-end; justify-content:space-between; gap: 12px; margin-top: 6px; }
  .chips{ display:flex; gap: 8px; flex-wrap: wrap; }
  .chipBtn{
    border-radius: 999px; border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.18); color: rgba(255,255,255,0.92);
    padding: 8px 12px; font-weight: 800; cursor:pointer;
  }
  .chipBtn:hover{ border-color: rgba(255,255,255,0.30); }
  .chipBtnOn{ background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.24); }

  .actions{ display:flex; gap: 10px; align-items:center; flex-wrap: wrap; justify-content: flex-end; }
  .primaryBtn{
    border:0; border-radius: 12px; padding: 10px 14px;
    font-weight: 900; cursor:pointer;
    background: rgba(255,255,255,0.92); color: rgba(0,0,0,0.88);
  }
  .primaryBtn:disabled{ opacity:.6; cursor:not-allowed; }
  .ghostBtn{
    border-radius: 12px; padding: 10px 14px; font-weight: 900; cursor:pointer;
    background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.92);
    border: 1px solid rgba(255,255,255,0.14);
  }
  .ghostBtn:disabled{ opacity:.55; cursor:not-allowed; }
  .dangerBtn{
    border-radius: 12px; padding: 10px 14px; font-weight: 900; cursor:pointer;
    background: rgba(255, 160, 0, 0.12); color: rgba(255,255,255,0.92);
    border: 1px solid rgba(255, 160, 0, 0.30);
  }

  .miniGrid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 10px; }
  .mini{ border-radius: 14px; padding: 10px 12px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.10); }
  .miniRow{ display:flex; justify-content:space-between; gap: 10px; font-size: 12px; line-height: 1.6; }
  .miniKey{ opacity:.75; }
  .miniVal{ font-weight: 800; opacity:.95; text-align: end; }

  .grid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
  .card{
    border-radius: 16px; padding: 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.10);
  }
  .cardWide{ grid-column: 1 / -1; }
  .cardHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom: 10px; }
  .cardTitle{ font-weight: 900; letter-spacing: .2px; }
  .stats{ display:flex; gap: 14px; }
  .stat{ flex: 1; border-radius: 14px; padding: 12px; background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.10); }
  .statNum{ font-size: 26px; font-weight: 950; }
  .statLbl{ opacity: .75; font-size: 12px; margin-top: 4px; }

  .muted{ opacity:.85; font-size: 13px; line-height: 1.7; }
  .reportBox2{ background: rgba(0,0,0,0.20); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.94); }

  .advWrap{
    border-radius: 14px;
    padding: 12px;
    background: rgba(0,0,0,0.16);
    border: 1px solid rgba(255,255,255,0.10);
    margin-top: 10px;
  }
  .advHeader{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .advTitle{ font-weight: 950; }
  .advGrid{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 10px; }
  .advCard{
    border-radius: 14px;
    padding: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
  }
  .advCardTitle{ font-weight: 950; margin-bottom: 8px; }
  .paramRow{ display:grid; gap: 6px; margin-bottom: 10px; }
  .paramTop{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .paramName{ font-weight: 900; font-size: 12px; opacity: 0.95; }
  .paramVal{ font-weight: 950; font-size: 12px; opacity: 0.95; }
  .paramHint{ font-size: 12px; opacity: 0.78; line-height: 1.5; }
  .rangeInput{ width:100%; }

  .tinyPill{
    display:inline-flex; align-items:center; gap:6px;
    border-radius: 999px;
    padding: 6px 10px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.06);
    font-weight: 900;
    font-size: 12px;
  }

  .dd{ position: relative; }
  .ddBtn{
    width: 100%; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.22);
    color: rgba(255,255,255,0.92);
    padding: 10px 12px;
    display:flex; align-items:center; justify-content:space-between; gap: 10px;
    cursor:pointer;
  }
  .ddBtn:focus{
    outline:none; border-color: rgba(255,255,255,0.28);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
  }
  .ddBtnText{ text-align: start; font-weight: 800; }
  .ddCaret{ opacity:.8; }
  .ddMenu{
    position:absolute; z-index: 50;
    inset-inline-start: 0; inset-inline-end: 0;
    margin-top: 8px;
    border-radius: 14px; padding: 6px;
    background: rgba(10,14,24,0.98);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    max-height: 260px; overflow:auto;
  }
  .ddItem{
    width: 100%;
    text-align: start;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: rgba(255,255,255,0.92);
    padding: 10px 10px;
    cursor:pointer;
    font-weight: 800;
  }
  .ddItem:hover{ background: rgba(255,255,255,0.10); }
  .ddItemActive{ background: rgba(255,255,255,0.14); outline: 1px solid rgba(255,255,255,0.12); }

  @media (max-width: 860px){
    .formRow{ grid-template-columns: 1fr; }
    .grid{ grid-template-columns: 1fr; }
    .methodRow{ flex-direction: column; align-items: stretch; }
    .actions{ justify-content: stretch; }
    .primaryBtn,.ghostBtn,.dangerBtn{ width:100%; }
    .miniVal{ text-align: start; }
    .advGrid{ grid-template-columns: 1fr; }
  }
`;

/* =========================
   ✅ Helpers
   ========================= */
function upper(x) {
  return String(x || "").toUpperCase();
}
function safeText(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}
function clampNum(x, min, max) {
  const v = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function clampInt(x, min, max) {
  const v = parseInt(String(x), 10);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function toNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}
function fmtPct(x) {
  if (x === null || x === undefined) return "—";
  const n = Number(x);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}
function extractDateRange(j) {
  const dr = j?.analysis?.dateRange || j?.data?.dateRange || j?.dateRange || null;
  if (!dr) return null;
  const start = dr.start ?? null;
  const end = dr.end ?? null;
  const filtered = dr.filtered ?? null;
  return { start, end, filtered };
}
function extractReport(report, lang) {
  if (!report) return "";
  if (typeof report === "string") return report;
  if (typeof report === "object") {
    if (report[lang]) return String(report[lang] || "");
    if (report.text?.[lang]) return String(report.text?.[lang] || "");
  }
  return "";
}
async function fetchJSON(url, signal) {
  const res = await fetch(url, { method: "GET", signal });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    const msg = j?.error || j?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return j;
}
async function postFile(url, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url, { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) {
    const msg = j?.error || j?.message || `Upload failed (${res.status})`;
    throw new Error(msg);
  }
  return j;
}
function normalizeDateRange(startDate, endDate) {
  const s = (startDate || "").trim();
  const e = (endDate || "").trim();
  if (!s || !e) return { start: s, end: e, swapped: false };
  if (s <= e) return { start: s, end: e, swapped: false };
  return { start: e, end: s, swapped: true };
}

/* =========================
   ✅ Chart adapters
   ========================= */
function adaptEWMA(payload) {
  const ew = payload?.data?.ewma || payload?.ewma || null;
  const pts = ew?.points || [];
  const series = pts
    .map((p) => ({
      label: p.week || p.label || "",
      value: toNum(p.z) ?? toNum(p.lowRate) ?? toNum(p.value),
      alert: !!p.alert,
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(ew?.UCL);

  return {
    title: "EWMA trend",
    subtitle:
      "EWMA summarizes recent changes smoothly. Crossing the dashed line suggests an unusual shift.",
    yLabel: threshold !== null ? "EWMA Z (risk score)" : "Value",
    points: series,
    threshold,
  };
}

function adaptCUSUM(payload) {
  const cu = payload?.data?.cusum || payload?.cusum || null;
  const pts = cu?.points || cu?.series || [];
  const series = (pts || [])
    .map((p) => ({
      label: p.week || p.label || "",
      value: toNum(p.S) ?? toNum(p.s) ?? toNum(p.cusum) ?? toNum(p.value) ?? toNum(p.z),
      alert: !!(p.alert || p.isAlert),
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(cu?.h) ?? toNum(cu?.H) ?? toNum(cu?.threshold);

  return {
    title: "CUSUM accumulation",
    subtitle:
      "CUSUM accumulates small deviations. A steady climb toward the dashed line indicates persistent change.",
    yLabel: threshold !== null ? "CUSUM score" : "Value",
    points: series,
    threshold,
  };
}

function adaptFarrington(payload) {
  const fa = payload?.data?.farrington || payload?.farrington || null;
  const pts = fa?.points || fa?.series || [];
  const series = (pts || [])
    .map((p) => ({
      label: p.week || p.label || "",
      value:
        toNum(p.z) ??
        toNum(p.score) ??
        toNum(p.value) ??
        toNum(p.obs) ??
        toNum(p.observed) ??
        toNum(p.low),
      alert: !!(p.alert || p.isAlert),
    }))
    .filter((p) => p.value !== null);

  const threshold = toNum(fa?.UCL) ?? toNum(fa?.ucl) ?? toNum(fa?.threshold);

  return {
    title: "Farrington anomaly",
    subtitle:
      "Farrington compares observed counts to an expected baseline. Above the dashed line suggests an anomaly.",
    yLabel: threshold !== null ? "Anomaly score" : "Value",
    points: series,
    threshold,
  };
}

/* =========================
   ✅ Dropdown
   ========================= */
function Dropdown({ value, onChange, options, placeholder, dir = "ltr" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((s) => !s);
    }
  }

  return (
    <div className="dd" ref={rootRef} dir={dir}>
      <button
        type="button"
        className="ddBtn"
        onClick={() => setOpen((s) => !s)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ddBtnText">{current?.label || placeholder || "—"}</span>
        <span className="ddCaret">▾</span>
      </button>

      {open ? (
        <div className="ddMenu" role="listbox">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                className={`ddItem ${active ? "ddItemActive" : ""}`}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   ✅ Reusable Param slider
   ========================= */
function ParamSlider({ name, value, min, max, step = 0.1, onChange, hint }) {
  return (
    <div className="paramRow">
      <div className="paramTop">
        <div className="paramName">{name}</div>
        <div className="paramVal">{String(value)}</div>
      </div>
      <input
        className="rangeInput"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <div className="paramHint">{hint}</div> : null}
    </div>
  );
}

/* =========================
   ✅ Page
   ========================= */
export default function SurveillanceDashboard({ lang = "en" }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);
  const isRTL = lang === "ar";

  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  // ✅ Start Global + empty inputs (per your request)
  const [scopeMode, setScopeMode] = useState("global");
  const [facilityId, setFacilityId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [labId, setLabId] = useState("");

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

  // Charts payload from RUN (general)
  const [chartsPayload, setChartsPayload] = useState(null);

  // Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

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

    // ✅ scope (optional)
    if (scopeMode === "facility" && String(facilityId || "").trim()) {
      params.set("facilityId", String(facilityId || "").trim());
    }
    if (scopeMode === "region" && String(regionId || "").trim()) {
      params.set("regionId", String(regionId || "").trim());
    }
    // global -> send nothing

    const lab = String(labId || "").trim();
    if (lab) params.set("labId", lab);

    const norm = normalizeDateRange(startDate, endDate);
    if (norm.start) params.set("startDate", norm.start);
    if (norm.end) params.set("endDate", norm.end);

    if (preset) params.set("preset", preset);

    // ✅ generalize: always pass testCode
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
        String(
          clampInt(
            farringtonBaselineWeeks,
            BOUNDS.farrington.baselineWeeks.min,
            BOUNDS.farrington.baselineWeeks.max
          )
        )
      );
      params.set("farringtonZ", String(clampNum(farringtonZ, BOUNDS.farrington.z.min, BOUNDS.farrington.z.max)));
    }

    return params;
  }

  function scopeLabel() {
    if (scopeMode === "global") return isRTL ? "وطني (كل البيانات)" : "Global (all data)";

    const core =
      scopeMode === "facility"
        ? `${t.modeFacility}: ${facilityId?.trim() || t.notAvailable}`
        : `${t.modeRegion}: ${regionId?.trim() || t.notAvailable}`;

    const lab = labId?.trim() ? (isRTL ? ` • المختبر: ${labId.trim()}` : ` • Lab: ${labId.trim()}`) : "";
    return core + lab;
  }

  async function uploadCsv() {
    if (!uploadFile) return;

    setUploading(true);
    setUploadErr("");
    setUploadResult(null);

    try {
      // ✅ matches your backend: POST /api/upload/lab-results
      const j = await postFile(`${apiBase}/api/upload/csv`, uploadFile);

      setUploadResult(j);

      const dr = extractDateRange(j);
      if (dr) setDataRange(dr);

      try {
        const hj = await fetchJSON(`${apiBase}/health`);
        setLastUpdated(hj?.time || hj?.timestamp || null);
      } catch {}
    } catch (e) {
      setUploadErr(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis() {
    const m = selectedMethods();
    if (!m.length) return;

    // ✅ minimal validation (only when user selects that scope)
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

    try {
      const scopeParams = buildScopeQuery();

      // ✅ General run endpoint (signal + testCode)
      const runParams = new URLSearchParams(scopeParams);
      runParams.set("signal", derivedSignal);
      runParams.set("methods", m.join(","));
      runParams.set("lang", "both");

      const runJ = await fetchJSON(`${apiBase}/api/analytics/run?${runParams.toString()}`, controller.signal);
      setRunData(runJ?.data || null);

      const dr1 = extractDateRange(runJ);
      if (dr1) setDataRange(dr1);

      // ✅ Build chart payload from run results (no anemia-only endpoints)
      const results = runJ?.data?.results || {};
      setChartsPayload({
        ewma: results?.ewma ? { data: { ewma: results.ewma } } : null,
        cusum: results?.cusum ? { data: { cusum: results.cusum } } : null,
        farrington: results?.farrington ? { data: { farrington: results.farrington } } : null,
      });

      // ✅ Report endpoint (signal + testCode)
      const reportParams = new URLSearchParams(scopeParams);
      reportParams.set("signal", derivedSignal);
      reportParams.set("testCode", String(testCode));
      reportParams.set("methods", m.join(","));
      reportParams.set("lang", lang);

      const repJ = await fetchJSON(`${apiBase}/api/analytics/report?${reportParams.toString()}`, controller.signal);
      const extracted = extractReport(repJ?.data?.report, lang);
      const finalReport = (extracted?.trim() ? extracted : "").trim();
      setReportText(finalReport || t.insufficient);

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

  const consensus = runData?.consensus;
  const decision = upper(consensus?.decision || "info");
  const counts = consensus?.counts || { alert: 0, watch: 0 };

  // ✅ stratification
  const profile = runData?.profile || null;
  const profileInsight = runData?.profileInsight || null;

  const trustMethods = methodsLabel(selectedMethods());
  const dataset = uploadResult?.ok ? t.uploadOk : t.notAvailable;

  const ewCfg = adaptEWMA(chartsPayload?.ewma);
  const cuCfg = adaptCUSUM(chartsPayload?.cusum);
  const faCfg = adaptFarrington(chartsPayload?.farrington);

  const presetLabel = preset === "low" ? t.presetLow : preset === "high" ? t.presetHigh : t.presetStandard;

  const canRunNow = !loading && !uploading;

  const insightText =
    lang === "ar"
      ? profileInsight?.ar?.keyFinding || profileInsight?.ar?.summary || ""
      : profileInsight?.en?.keyFinding || profileInsight?.en?.summary || "";

  return (
    <div className="dash" dir={isRTL ? "rtl" : "ltr"}>
      <style>{styles}</style>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelTitle">{t.title}</div>
            <div className="panelHint">{t.note}</div>
          </div>
        </div>

        {/* Upload */}
        <div className="formRow">
          <div className="field">
            <label>{t.uploadTitle}</label>
            <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
          </div>
          <div className="actions" style={{ alignSelf: "end" }}>
            <button type="button" className="ghostBtn" onClick={uploadCsv} disabled={!uploadFile || uploading}>
              {uploading ? t.uploading : t.upload}
            </button>
          </div>
        </div>

        {uploadErr ? <div className="muted" style={{ marginTop: 6 }}>{uploadErr}</div> : null}

        {/* Scope + Lab */}
        <div className="formRow" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t.scope}</label>
            <Dropdown
              dir={isRTL ? "rtl" : "ltr"}
              value={scopeMode}
              onChange={(v) => setScopeMode(v)}
              options={getScopeOptions(t)}
            />
          </div>

          <div className="field">
            <label>{t.lab}</label>
            <input value={labId} onChange={(e) => setLabId(e.target.value)} placeholder={t.placeholderLab} />
          </div>
        </div>

        {/* Facility/Region + Test */}
        <div className="formRow">
          {scopeMode === "facility" ? (
            <div className="field">
              <label>{t.facility}</label>
              <input
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                placeholder={t.placeholderFacility}
              />
            </div>
          ) : scopeMode === "region" ? (
            <div className="field">
              <label>{t.region}</label>
              <input value={regionId} onChange={(e) => setRegionId(e.target.value)} placeholder={t.placeholderRegion} />
            </div>
          ) : (
            <div className="field">
              <label>{isRTL ? "الكل" : "All"}</label>
              <input value={isRTL ? " وطني  (كل البيانات)" : "Global (all data)"} readOnly />
            </div>
          )}

          <div className="field">
            <label>{t.test}</label>
            <Dropdown
              dir={isRTL ? "rtl" : "ltr"}
              value={testCode}
              onChange={(v) => setTestCode(v)}
              options={getTestOptions(t)}
            />
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
              <button type="button" className="ghostBtn" onClick={() => { setStartDate(""); setEndDate(""); }}>
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
              {t.presetActive}: <span className="tinyPill">{presetLabel}</span>{" "}
              • {t.advancedActive}: <span className="tinyPill">{advanced ? t.yes : t.no}</span>
            </div>
          </div>
        </div>

        {/* Advanced Panel */}
        <div className="advWrap">
          <div className="advHeader">
            <div>
              <div className="advTitle">{t.advanced}</div>
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
            <div className="advGrid">
              <div className="advCard">
                <div className="advCardTitle">{t.ewmaBlock}</div>
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

              <div className="advCard">
                <div className="advCardTitle">{t.cusumBlock}</div>
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

              <div className="advCard">
                <div className="advCardTitle">{t.farringtonBlock}</div>
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
        <div className="methodRow">
          <div className="field" style={{ flex: 1 }}>
            <label>{t.methods}</label>
            <div className="chips">
              <button type="button" className={`chipBtn ${methods.ewma ? "chipBtnOn" : ""}`} onClick={() => toggleMethod("ewma")}>
                EWMA
              </button>
              <button type="button" className={`chipBtn ${methods.cusum ? "chipBtnOn" : ""}`} onClick={() => toggleMethod("cusum")}>
                CUSUM
              </button>
              <button type="button" className={`chipBtn ${methods.farrington ? "chipBtnOn" : ""}`} onClick={() => toggleMethod("farrington")}>
                Farrington
              </button>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="dangerBtn" onClick={() => { setPreset("high"); setAdvanced(false); }} disabled={loading}>
              {t.quickHigh}
            </button>

            <button type="button" className="primaryBtn" onClick={runAnalysis} disabled={!canRunNow}>
              {loading ? "…" : t.run}
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

      {/* Results */}
      <section className="grid">
        <DecisionCard title={t.consensus} value={upper(decision)} hint={t.empty} />

        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">{t.ensemble}</div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="statNum">{counts.watch ?? 0}</div>
              <div className="statLbl">{t.watch}</div>
            </div>
            <div className="stat">
              <div className="statNum">{counts.alert ?? 0}</div>
              <div className="statLbl">{t.alerts}</div>
            </div>
          </div>
        </div>

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

        {/* ✅ Population Stratification (RESTORED) */}
        <div className="card cardWide">
          <div className="cardHeader">
            <div className="cardTitle">{t.strat}</div>
          </div>

          {!profile ? (
            <div className="muted">{t.empty}</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {/* Overall */}
              <div className="mini">
                <div className="miniRow">
                  <div className="miniKey">{t.totalSamples}</div>
                  <div className="miniVal">{profile?.overall?.n ?? 0}</div>
                </div>
                <div className="miniRow">
                  <div className="miniKey">{t.signalRate}</div>
                  <div className="miniVal">{fmtPct(profile?.overall?.lowRate ?? profile?.overall?.highRate)}</div>
                </div>
              </div>

              {/* By Sex */}
              <div className="mini">
                <div className="miniRow">
                  <div className="miniKey">{t.bySex}</div>
                  <div className="miniVal"></div>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {(profile?.bySex || []).map((x, idx) => (
                    <div key={idx} className="miniRow">
                      <div className="miniKey">{x.sex}</div>
                      <div className="miniVal">
                        {x.n} • {fmtPct(x.lowRate ?? x.highRate)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Age */}
              <div className="mini">
                <div className="miniRow">
                  <div className="miniKey">{t.byAge}</div>
                  <div className="miniVal"></div>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {(profile?.byAge || []).map((x, idx) => (
                    <div key={idx} className="miniRow">
                      <div className="miniKey">{x.ageBand}</div>
                      <div className="miniVal">
                        {x.n} • {fmtPct(x.lowRate ?? x.highRate)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Nationality (if backend provides it later) */}
              {Array.isArray(profile?.byNationality) && profile.byNationality.length ? (
                <div className="mini">
                  <div className="miniRow">
                    <div className="miniKey">{t.byNationality}</div>
                    <div className="miniVal"></div>
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {profile.byNationality.map((x, idx) => (
                      <div key={idx} className="miniRow">
                        <div className="miniKey">{x.nationality || "—"}</div>
                        <div className="miniVal">
                          {x.n} • {fmtPct(x.lowRate ?? x.highRate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Insight */}
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

        {/* Narrative */}
        <div className="card cardWide">
          <div className="cardHeader">
            <div className="cardTitle">{t.narrative}</div>
          </div>

          <div
            className="reportBox2"
            dir={isRTL ? "rtl" : "ltr"}
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.8,
              padding: 12,
              borderRadius: 12,
              minHeight: 180,
            }}
          >
            {reportText || t.empty}
          </div>

          {!reportText ? <div className="muted" style={{ marginTop: 8 }}>{t.insufficient}</div> : null}
        </div>
      </section>
    </div>
  );
}
