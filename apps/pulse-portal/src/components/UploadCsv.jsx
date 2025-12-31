import React, { useMemo, useState } from "react";

/**
 * UploadCsv.jsx — Professional single upload center
 * - One upload area only
 * - Clear, stable post-upload summary (no overlap)
 * - Realistic status banner (success / uploaded but unusable / failed)
 * - Readiness badge (Ready / Needs review / Empty)
 * - Normalizes backend responses across shapes
 * - Calls onUploaded(normalized) so Dashboard can show ONE banner globally if needed
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

    // status headlines (more realistic)
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
    inserted: "تمت إضافتها",
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
    inserted: "Inserted",
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

/**
 * Normalize upload response across multiple backend shapes.
 */
function normalizeUploadResult(j) {
  if (!j || typeof j !== "object") return null;

  const facilityId =
    j.facilityId ??
    j?.data?.facilityId ??
    j?.analysis?.params?.facilityId ??
    j?.data?.ingest?.facilityId ??
    null;

  const fileName =
    j?.file?.originalName ??
    j?.file?.name ??
    j?.data?.file?.originalName ??
    j?.data?.file?.name ??
    null;

  const sizeBytes =
    j?.file?.sizeBytes ??
    j?.file?.size ??
    j?.data?.file?.sizeBytes ??
    j?.data?.file?.size ??
    null;

  const sha256 =
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

  const processed = j?.processed ?? j?.data?.processed ?? null;

  const rows =
    processed?.rows ??
    j?.rows ??
    j?.data?.rows ??
    j?.analysis?.params?.rowsParsed ??
    j?.data?.ingest?.rowsParsed ??
    null;

  const inserted =
    processed?.inserted ??
    j?.inserted ??
    j?.insertedCount ??
    j?.data?.inserted ??
    j?.data?.insertedCount ??
    null;

  const skipped = processed?.skipped ?? j?.skipped ?? j?.data?.skipped ?? null;

  const duplicates = processed?.duplicates ?? j?.duplicates ?? j?.data?.duplicates ?? null;

  const errors =
    processed?.errors ??
    j?.errors ??
    j?.errorsCount ??
    j?.data?.errors ??
    j?.data?.errorsCount ??
    null;

  // Old ingest summary fallback
  const summary = j?.data?.ingest?.summary ?? j?.ingest?.summary ?? null;
  const accepted = summary?.accepted ?? null;
  const rejected = summary?.rejected ?? null;

  return {
    facilityId,
    fileName,
    sizeBytes,
    sha256,
    dateRange,
    rows,
    inserted,
    skipped,
    duplicates,
    errors,
    accepted,
    rejected,
    raw: j,
  };
}

function readinessFromCounts({ rows, inserted, accepted, errors }) {
  const r = toNum(rows) ?? 0;
  const i = toNum(inserted);
  const a = toNum(accepted);
  const e = toNum(errors) ?? 0;

  const okCount = (i ?? a ?? 0);

  if (r <= 0 || okCount <= 0) return "empty";
  if (e > 0) return "needsReview";
  return "ready";
}

// ✅ derive realistic UI status from counts
function deriveUploadUi({ ok, rows, acceptedLike, errors }, t) {
  const r = toNum(rows) ?? 0;
  const a = toNum(acceptedLike) ?? 0;
  const e = toNum(errors) ?? 0;

  // buckets: ok | warn | error
  if (!ok || e > 0) {
    return { tone: "error", title: t.err, icon: "❌" };
  }
  if (a > 0) {
    return { tone: "ok", title: t.okProcessed, icon: "✅" };
  }
  if (r > 0 && a === 0) {
    return { tone: "warn", title: t.okNoAccepted, icon: "⚠️" };
  }
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
  const inserted = result?.inserted ?? null;
  const acceptedFallback = result?.accepted ?? null;
  const acceptedLike = inserted ?? acceptedFallback ?? 0;

  const rejected = result?.rejected ?? null;
  const skipped = result?.skipped ?? null;
  const duplicates = result?.duplicates ?? null;
  const errorsCount = result?.errors ?? null;

  const readiness = useMemo(() => {
    return readinessFromCounts({
      rows,
      inserted,
      accepted: acceptedFallback,
      errors: errorsCount,
    });
  }, [rows, inserted, acceptedFallback, errorsCount]);

  const readinessLabel =
    readiness === "ready"
      ? t.ready
      : readiness === "needsReview"
      ? t.needsReview
      : t.empty;

  const uiStatus = useMemo(() => {
    return deriveUploadUi(
      {
        ok: !!(resultRaw?.ok ?? true),
        rows,
        acceptedLike,
        errors: errorsCount,
      },
      t
    );
  }, [resultRaw, rows, acceptedLike, errorsCount, t]);

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
            accepted: norm?.inserted ?? norm?.accepted ?? null,
            rejected: norm?.rejected ?? null,
            skipped: norm?.skipped ?? null,
            duplicates: norm?.duplicates ?? null,
            errors: norm?.errors ?? null,
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
              <b>{t.fileSize}:</b>{" "}
              <span className="mono">{fmtBytes(file.size)}</span>
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
          {/* ✅ realistic headline instead of always "success" */}
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
                    <span className="miniVal">{toNum(acceptedLike) ?? 0}</span>
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
                    background: "rgba(0,0,0,0.20)",
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
