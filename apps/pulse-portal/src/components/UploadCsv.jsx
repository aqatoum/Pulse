import React, { useMemo, useState } from "react";

/**
 * UploadCsv.jsx — Professional single upload center (FIXED)
 * ✅ Fixes the “accepted = 0 / no usable data” bug by treating Cloud Run ingest response as source of truth:
 *   - data.ingest.totalRows
 *   - data.ingest.accepted
 *   - data.ingest.rejected
 *   - data.ingest.issues (summed as errors)
 *
 * - One upload area only
 * - Clear, stable post-upload summary (no overlap)
 * - Realistic status banner (success / needs review / empty / failed)
 * - Readiness badge (Ready / Needs review / Empty)
 * - Calls onUploaded(normalized)
 */

const TXT = {
  ar: {
    title: "رفع ملف CSV",
    hint: "ارفع نتائج الفحوصات لإدخالها للنظام على مستوى سكاني (Population-level).",
    choose: "اختر ملف CSV",
    upload: "رفع الملف",
    uploading: "جاري الرفع…",
    replace: "استبدال بملف جديد",
    clear: "مسح نتيجة الرفع",

    okProcessed: "تم رفع الملف ومعالجة البيانات بنجاح",
    okNoAccepted: "تم رفع الملف، لكن لم يتم قبول أي صف. راجع تنسيق الأعمدة والقيم.",
    okNoRows: "تم رفع الملف، لكن لم يتم العثور على صفوف قابلة للقراءة.",
    err: "فشل رفع/معالجة الملف. راجع التفاصيل التقنية.",

    meta: "ملخص الرفع",
    facility: "رمز المرفق (Facility)",
    fileName: "اسم الملف",
    fileSize: "حجم الملف",
    rows: "إجمالي الصفوف",
    tests: "الصفوف المقبولة",
    accepted: "مقبول",
    rejected: "مرفوض",
    skipped: "متجاهلة",
    duplicates: "مكررة",
    errors: "أخطاء",
    dateRange: "النطاق الزمني",
    hash: "بصمة الملف",
    uploadedAt: "وقت الرفع",
    readiness: "جاهزية الملف",
    ready: "جاهز للتحليل",
    needsReview: "بحاجة لمراجعة",
    empty: "لا يوجد بيانات قابلة للاستخدام",
    showDetails: "عرض التفاصيل التقنية",
    hideDetails: "إخفاء التفاصيل التقنية",
    serverSays: "رد السيرفر",
  },
  en: {
    title: "Upload CSV",
    hint: "Upload lab results to ingest into the system (population-level).",
    choose: "Choose CSV file",
    upload: "Upload",
    uploading: "Uploading…",
    replace: "Replace with a new file",
    clear: "Clear upload result",

    okProcessed: "Upload succeeded and data were processed",
    okNoAccepted: "File uploaded, but no rows were accepted. Check headers/values.",
    okNoRows: "File uploaded, but no readable rows were found.",
    err: "Upload/processing failed. Check technical details.",

    meta: "Upload summary",
    facility: "Facility ID",
    fileName: "File name",
    fileSize: "File size",
    rows: "Total rows",
    tests: "Accepted rows",
    accepted: "Accepted",
    rejected: "Rejected",
    skipped: "Skipped",
    duplicates: "Duplicates",
    errors: "Errors",
    dateRange: "Date range",
    hash: "File fingerprint",
    uploadedAt: "Uploaded at",
    readiness: "File readiness",
    ready: "Ready for analysis",
    needsReview: "Needs review",
    empty: "No usable data",
    showDetails: "Show technical details",
    hideDetails: "Hide technical details",
    serverSays: "Server response",
  },
};

/* =========================
   Helpers
   ========================= */
function toNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fmtBytes(bytes) {
  const n = toNum(bytes);
  if (n === null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isoNow() {
  return new Date().toISOString();
}

function sumIssueCounts(issues) {
  if (!issues || typeof issues !== "object") return 0;
  return Object.values(issues).reduce((a, b) => a + Number(b || 0), 0);
}

/**
 * ✅ Normalize upload response across multiple backend shapes.
 * Supports your current Cloud Run response:
 *  - analysis.params.rowsParsed
 *  - analysis.params.fileName
 *  - data.upload.{uploadId,sha256,fileName}
 *  - data.ingest.{totalRows,accepted,rejected,issues{...}}
 */
function normalizeUploadResult(j) {
  if (!j || typeof j !== "object") return null;

  const ingest = j?.data?.ingest || j?.ingest || null;
  const issues = ingest?.issues || null;

  const facilityId =
    j?.facilityId ??
    j?.data?.facilityId ??
    j?.analysis?.params?.facilityId ??
    ingest?.facilityId ??
    null;

  const fileName =
    j?.analysis?.params?.fileName ??
    j?.data?.upload?.fileName ??
    j?.data?.upload?.originalFileName ??
    j?.file?.originalName ??
    j?.file?.name ??
    j?.data?.file?.originalName ??
    j?.data?.file?.name ??
    null;

  const sizeBytes =
    j?.analysis?.params?.sizeBytes ??
    j?.file?.sizeBytes ??
    j?.file?.size ??
    j?.data?.file?.sizeBytes ??
    j?.data?.file?.size ??
    null;

  const sha256 =
    j?.data?.upload?.sha256 ??
    j?.file?.sha256 ??
    j?.sha256 ??
    j?.data?.file?.sha256 ??
    j?.data?.sha256 ??
    null;

  const dateRange =
    j?.dateRange ??
    j?.data?.dateRange ??
    j?.analysis?.dateRange ??
    j?.data?.analysis?.dateRange ??
    null;

  // ✅ Source of truth for Cloud Run: ingest.totalRows
  const rows =
    ingest?.totalRows ??
    j?.analysis?.params?.rowsParsed ??
    j?.processed?.rows ??
    j?.rows ??
    j?.data?.rows ??
    null;

  // ✅ Source of truth for Cloud Run: ingest.accepted / ingest.rejected
  const accepted =
    ingest?.accepted ??
    j?.processed?.accepted ??
    j?.accepted ??
    j?.data?.accepted ??
    j?.data?.ingest?.summary?.accepted ??
    j?.ingest?.summary?.accepted ??
    null;

  const rejected =
    ingest?.rejected ??
    j?.processed?.rejected ??
    j?.rejected ??
    j?.data?.rejected ??
    j?.data?.ingest?.summary?.rejected ??
    j?.ingest?.summary?.rejected ??
    null;

  // ✅ errors = sum(issues) when present (Cloud Run)
  const errors =
    issues && typeof issues === "object"
      ? sumIssueCounts(issues)
      : j?.processed?.errors ??
        j?.errors ??
        j?.errorsCount ??
        j?.data?.errors ??
        j?.data?.errorsCount ??
        0;

  // optional (may not exist in your API)
  const skipped = j?.processed?.skipped ?? j?.skipped ?? j?.data?.skipped ?? 0;
  const duplicates = j?.processed?.duplicates ?? j?.duplicates ?? j?.data?.duplicates ?? 0;

  return {
    facilityId,
    fileName,
    sizeBytes,
    sha256,
    dateRange,
    rows,
    accepted,
    rejected,
    skipped,
    duplicates,
    errors,
    raw: j,
  };
}

/**
 * ✅ Correct readiness logic
 * - empty: rows == 0 (no readable rows)
 * - needsReview: rows > 0 but accepted == 0 OR errors > 0
 * - ready: accepted > 0 and errors == 0
 */
function readinessFromCounts({ rows, accepted, errors }) {
  const r = toNum(rows) ?? 0;
  const a = toNum(accepted) ?? 0;
  const e = toNum(errors) ?? 0;

  if (r === 0) return "empty";
  if (a === 0) return "needsReview";
  if (e > 0) return "needsReview";
  return "ready";
}

// ✅ derive realistic UI status from counts (accepted is truth)
function deriveUploadUi({ ok, rows, accepted, errors }, t) {
  const r = toNum(rows) ?? 0;
  const a = toNum(accepted) ?? 0;
  const e = toNum(errors) ?? 0;

  if (!ok) return { tone: "error", title: t.err, icon: "❌" };

  // upload ok, but quality issues exist
  if (a > 0 && e > 0) return { tone: "warn", title: t.needsReview, icon: "⚠️" };

  if (a > 0) return { tone: "ok", title: t.okProcessed, icon: "✅" };
  if (r > 0 && a === 0) return { tone: "warn", title: t.okNoAccepted, icon: "⚠️" };
  return { tone: "warn", title: t.okNoRows, icon: "⚠️" };
}

export default function UploadCsv({ lang = "ar", onUploaded }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);
  const isRTL = lang === "ar";

  const API =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultRaw, setResultRaw] = useState(null);
  const [uploadedAt, setUploadedAt] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => normalizeUploadResult(resultRaw), [resultRaw]);

  const rows = result?.rows ?? null;
  const accepted = result?.accepted ?? 0; // ✅ truth
  const rejected = result?.rejected ?? 0;
  const skipped = result?.skipped ?? 0;
  const duplicates = result?.duplicates ?? 0;
  const errorsCount = result?.errors ?? 0;

  const readiness = useMemo(() => {
    return readinessFromCounts({ rows, accepted, errors: errorsCount });
  }, [rows, accepted, errorsCount]);

  const readinessLabel =
    readiness === "ready" ? t.ready : readiness === "needsReview" ? t.needsReview : t.empty;

  const uiStatus = useMemo(() => {
    return deriveUploadUi(
      {
        ok: !!(resultRaw?.ok ?? true),
        rows,
        accepted,
        errors: errorsCount,
      },
      t
    );
  }, [resultRaw, rows, accepted, errorsCount, t]);

  async function upload() {
    setError("");
    setResultRaw(null);
    setShowDetails(false);

    if (!file) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const r = await fetch(`${API}/api/upload/csv`, {
        method: "POST",
        body: fd,
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || j?.ok === false) {
        throw new Error(j?.error || j?.message || "Upload failed");
      }

      setResultRaw(j);
      const now = isoNow();
      setUploadedAt(now);

      if (typeof onUploaded === "function") {
        const norm = normalizeUploadResult(j);

        onUploaded({
          ok: true,
          at: now,
          facilityId: norm?.facilityId ?? null,
          processed: {
            rows: norm?.rows ?? null,
            accepted: norm?.accepted ?? 0, // ✅ FIXED (was inserted fallback)
            rejected: norm?.rejected ?? 0,
            skipped: norm?.skipped ?? 0,
            duplicates: norm?.duplicates ?? 0,
            errors: norm?.errors ?? 0,
          },
          dateRange: norm?.dateRange ?? null,
          file: {
            originalName: file?.name ?? norm?.fileName ?? null,
            sizeBytes: file?.size ?? norm?.sizeBytes ?? null,
            sha256: norm?.sha256 ?? null,
          },
          raw: j,
        });
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function clearResult() {
    setResultRaw(null);
    setUploadedAt(null);
    setShowDetails(false);
    setError("");
  }

  return (
    <div className="card" dir={isRTL ? "rtl" : "ltr"}>
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{t.title}</div>
          <div className="muted">{t.hint}</div>
        </div>

        {resultRaw ? (
          <span className="tinyPill" title={t.readiness}>
            {t.readiness}: {readinessLabel}
          </span>
        ) : null}
      </div>

      {/* Single upload row */}
      <div className="formRow">
        <div className="field">
          <label>{t.choose}</label>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError("");
            }}
          />
          {file?.name ? (
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              <b>{t.fileName}:</b> <span className="mono">{file.name}</span> •{" "}
              <b>{t.fileSize}:</b> <span className="mono">{fmtBytes(file.size)}</span>
            </div>
          ) : null}
        </div>

        <div className="actions" style={{ justifyContent: "flex-end", alignSelf: "end" }}>
          <button className="primaryBtn" onClick={upload} disabled={busy || !file}>
            {busy ? t.uploading : t.upload}
          </button>

          {resultRaw ? (
            <button className="ghostBtn" type="button" onClick={clearResult} disabled={busy}>
              {t.clear}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="muted" style={{ marginTop: 12 }}>
          <strong>{t.err}</strong> {error}
        </div>
      ) : null}

      {/* Stable post-upload summary (REALISTIC) */}
      {resultRaw ? (
        <div className="banner" style={{ marginTop: 12 }}>
          <div className="bannerTitle">
            {uiStatus.icon} {uiStatus.title}
          </div>

          <div className="bannerGrid">
            <div className="bannerBox">
              <div style={{ fontWeight: 950, marginBottom: 6 }}>{t.meta}</div>

              <div>
                <span style={{ opacity: 0.8 }}>{t.facility}: </span>
                <span className="mono">{result?.facilityId ?? "—"}</span>
              </div>

              <div>
                <span style={{ opacity: 0.8 }}>{t.fileName}: </span>
                <span className="mono">{file?.name ?? result?.fileName ?? "—"}</span>
              </div>

              <div>
                <span style={{ opacity: 0.8 }}>{t.fileSize}: </span>
                <span className="mono">{fmtBytes(file?.size ?? result?.sizeBytes)}</span>
              </div>

              <div>
                <span style={{ opacity: 0.8 }}>{t.uploadedAt}: </span>
                <span className="mono">{uploadedAt ?? "—"}</span>
              </div>

              {result?.dateRange?.start || result?.dateRange?.end ? (
                <div style={{ marginTop: 6, opacity: 0.92 }}>
                  <span style={{ opacity: 0.8 }}>{t.dateRange}: </span>
                  <span className="mono">
                    {safeText(result?.dateRange?.start)} → {safeText(result?.dateRange?.end)}
                  </span>
                </div>
              ) : null}

              {result?.sha256 ? (
                <div style={{ marginTop: 6, opacity: 0.92 }}>
                  <span style={{ opacity: 0.8 }}>{t.hash}: </span>
                  <span className="mono">{String(result.sha256).slice(0, 16)}…</span>
                </div>
              ) : null}
            </div>

            <div className="bannerBox">
              <div style={{ fontWeight: 950, marginBottom: 6 }}>
                {t.readiness}: {readinessLabel}
              </div>

              <div className="miniGrid" style={{ marginTop: 0 }}>
                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.rows}</span>
                    <span className="miniVal">{rows ?? "—"}</span>
                  </div>
                </div>

                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.tests}</span>
                    <span className="miniVal">{toNum(accepted) ?? 0}</span>
                  </div>
                </div>

                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.rejected}</span>
                    <span className="miniVal">{toNum(rejected) ?? 0}</span>
                  </div>
                </div>

                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.duplicates}</span>
                    <span className="miniVal">{toNum(duplicates) ?? 0}</span>
                  </div>
                </div>

                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.skipped}</span>
                    <span className="miniVal">{toNum(skipped) ?? 0}</span>
                  </div>
                </div>

                <div className="mini">
                  <div className="miniRow">
                    <span className="miniKey">{t.errors}</span>
                    <span className="miniVal">{toNum(errorsCount) ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
                <button className="ghostBtn" type="button" onClick={() => setShowDetails((s) => !s)}>
                  {showDetails ? t.hideDetails : t.showDetails}
                </button>
              </div>

              {showDetails ? (
                <pre
                  className="mono"
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.2)",
                    whiteSpace: "pre-wrap",
                    overflow: "auto",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
{JSON.stringify(resultRaw, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
