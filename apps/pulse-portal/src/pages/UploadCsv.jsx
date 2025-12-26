import React, { useMemo, useState } from "react";

/**
 * UploadCsv.jsx (fixed)
 * - Robust parsing for multiple backend response shapes (old/new)
 * - Trust summary: filename, size, rows, inserted/accepted, skipped/rejected, duplicates, errors, dateRange, hash
 * - onUploaded() returns a normalized payload so the Dashboard can show ONE upload banner in header cleanly.
 */

const TXT = {
  ar: {
    title: "رفع ملف CSV",
    hint: "ارفع نتائج الفحوصات ليتم إدخالها للنظام (Population-level).",
    choose: "اختر ملف CSV",
    upload: "رفع الملف",
    uploading: "جاري الرفع…",
    ok: "تم رفع الملف بنجاح",
    err: "فشل رفع الملف",
    meta: "ملخص الرفع",
    facility: "رمز المرفق",
    fileName: "الملف",
    fileSize: "الحجم",
    rows: "عدد الصفوف",
    inserted: "تمت إضافتها",
    accepted: "مقبول",
    rejected: "مرفوض",
    skipped: "متجاهلة",
    duplicates: "مكررة",
    errors: "أخطاء",
    dateRange: "النطاق الزمني",
    hash: "بصمة الملف",
    showDetails: "عرض التفاصيل",
    hideDetails: "إخفاء التفاصيل",
    quality: "جودة البيانات",
    missing: "قيم ناقصة",
    invalidDate: "تاريخ غير صالح",
    invalidHb: "Hb غير صالح",
    invalidAge: "عمر غير صالح",
    serverSays: "رد السيرفر",
  },
  en: {
    title: "Upload CSV",
    hint: "Upload lab results to ingest into the system (population-level).",
    choose: "Choose CSV file",
    upload: "Upload",
    uploading: "Uploading…",
    ok: "Upload successful",
    err: "Upload failed",
    meta: "Upload summary",
    facility: "Facility ID",
    fileName: "File",
    fileSize: "Size",
    rows: "Rows",
    inserted: "Inserted",
    accepted: "Accepted",
    rejected: "Rejected",
    skipped: "Skipped",
    duplicates: "Duplicates",
    errors: "Errors",
    dateRange: "Date range",
    hash: "File fingerprint",
    showDetails: "Show details",
    hideDetails: "Hide details",
    quality: "Data quality",
    missing: "Missing values",
    invalidDate: "Invalid date",
    invalidHb: "Invalid Hb",
    invalidAge: "Invalid age",
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

/**
 * Normalize upload response across potential shapes:
 * Preferred modern shape:
 *  { ok:true, message, file:{originalName,sizeBytes,sha256}, processed:{rows,inserted,skipped,duplicates,errors}, dateRange:{start,end}, facilityId? }
 *
 * Older shape variants seen in some builds:
 *  { ok:true, facilityId, data:{ ingest:{ summary:{accepted,rejected}, quality:{...} } }, analysis:{ params:{rowsParsed} } }
 */
function normalizeUploadResult(j) {
  if (!j || typeof j !== "object") return null;

  // Facility
  const facilityId =
    j.facilityId ??
    j?.data?.facilityId ??
    j?.analysis?.params?.facilityId ??
    j?.data?.ingest?.facilityId ??
    null;

  // File metadata
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

  // Date range
  const dateRange =
    j?.dateRange ??
    j?.data?.dateRange ??
    j?.analysis?.dateRange ??
    j?.data?.analysis?.dateRange ??
    null;

  // Counts (new)
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

  const skipped =
    processed?.skipped ??
    j?.skipped ??
    j?.data?.skipped ??
    null;

  const duplicates =
    processed?.duplicates ??
    j?.duplicates ??
    j?.data?.duplicates ??
    null;

  const errors =
    processed?.errors ??
    j?.errors ??
    j?.errorsCount ??
    j?.data?.errors ??
    j?.data?.errorsCount ??
    null;

  // Counts (old ingest summary)
  const summary = j?.data?.ingest?.summary ?? j?.ingest?.summary ?? null;
  const accepted = summary?.accepted ?? null;
  const rejected = summary?.rejected ?? null;

  // Quality (old)
  const quality = j?.data?.ingest?.quality ?? j?.ingest?.quality ?? null;

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
    quality,
    raw: j,
  };
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
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => normalizeUploadResult(resultRaw), [resultRaw]);

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

      // ✅ Send normalized summary back to dashboard
      if (typeof onUploaded === "function") {
        const norm = normalizeUploadResult(j);
        onUploaded({
          ok: true,
          facilityId: norm?.facilityId ?? null,
          processed: {
            rows: norm?.rows ?? null,
            inserted: norm?.inserted ?? norm?.accepted ?? null,
            skipped: norm?.skipped ?? norm?.rejected ?? null,
            duplicates: norm?.duplicates ?? null,
            errors: norm?.errors ?? null,
          },
          dateRange: norm?.dateRange ?? null,
          file: {
            originalName: file?.name ?? norm?.fileName ?? null,
            sizeBytes: file?.size ?? norm?.sizeBytes ?? null,
            sha256: norm?.sha256 ?? null,
          },
          quality: norm?.quality ?? null,
          raw: j,
        });
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  // Prefer new processed.* but fallback to old accepted/rejected
  const rows = result?.rows ?? null;
  const inserted = result?.inserted ?? result?.accepted ?? null;
  const skipped = result?.skipped ?? result?.rejected ?? null;

  const duplicates = result?.duplicates ?? null;
  const errorsCount = result?.errors ?? null;

  const quality = result?.quality ?? null;

  return (
    <div className="card" dir={isRTL ? "rtl" : "ltr"}>
      <div className="cardHeader">
        <div className="cardTitle">{t.title}</div>
        <div className="muted">{t.hint}</div>
      </div>

      <div className="formRow">
        <div className="field">
          <label>{t.choose}</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError("");
              setResultRaw(null);
              setShowDetails(false);
            }}
          />
        </div>

        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button className="primaryBtn" onClick={upload} disabled={busy || !file}>
            {busy ? t.uploading : t.upload}
          </button>
        </div>
      </div>

      {error ? (
        <div className="muted" style={{ marginTop: 12 }}>
          <strong>{t.err}:</strong> {error}
        </div>
      ) : null}

      {resultRaw ? (
        <div style={{ marginTop: 12 }}>
          <div className="badge" style={{ marginBottom: 10 }}>
            {t.ok}
          </div>

          <div className="muted" style={{ marginBottom: 8 }}>
            <strong>{t.meta}</strong>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="statNum">{result?.facilityId ?? "—"}</div>
              <div className="statLbl">{t.facility}</div>
            </div>

            <div className="stat">
              <div className="statNum">{file?.name ?? result?.fileName ?? "—"}</div>
              <div className="statLbl">{t.fileName}</div>
            </div>

            <div className="stat">
              <div className="statNum">{fmtBytes(file?.size ?? result?.sizeBytes)}</div>
              <div className="statLbl">{t.fileSize}</div>
            </div>

            <div className="stat">
              <div className="statNum">{rows ?? "—"}</div>
              <div className="statLbl">{t.rows}</div>
            </div>

            <div className="stat">
              <div className="statNum">{inserted ?? 0}</div>
              <div className="statLbl">{t.inserted}</div>
            </div>

            <div className="stat">
              <div className="statNum">{skipped ?? 0}</div>
              <div className="statLbl">{t.skipped}</div>
            </div>

            <div className="stat">
              <div className="statNum">{duplicates ?? 0}</div>
              <div className="statLbl">{t.duplicates}</div>
            </div>

            <div className="stat">
              <div className="statNum">{errorsCount ?? 0}</div>
              <div className="statLbl">{t.errors}</div>
            </div>
          </div>

          {result?.dateRange?.start || result?.dateRange?.end ? (
            <div className="muted" style={{ marginTop: 10 }}>
              <strong>{t.dateRange}:</strong>{" "}
              {safeText(result?.dateRange?.start)} → {safeText(result?.dateRange?.end)}
            </div>
          ) : null}

          {result?.sha256 ? (
            <div className="muted" style={{ marginTop: 6 }}>
              <strong>{t.hash}:</strong>{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace" }}>
                {String(result.sha256).slice(0, 16)}…
              </span>
            </div>
          ) : null}

          {/* Quality section (if backend provides it) */}
          {quality ? (
            <>
              <div className="muted" style={{ marginTop: 12, marginBottom: 8 }}>
                <strong>{t.quality}</strong>
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="statNum">{quality?.missingValues ?? 0}</div>
                  <div className="statLbl">{t.missing}</div>
                </div>
                <div className="stat">
                  <div className="statNum">{quality?.invalidDate ?? 0}</div>
                  <div className="statLbl">{t.invalidDate}</div>
                </div>
                <div className="stat">
                  <div className="statNum">{quality?.invalidHb ?? 0}</div>
                  <div className="statLbl">{t.invalidHb}</div>
                </div>
                <div className="stat">
                  <div className="statNum">{quality?.invalidAge ?? 0}</div>
                  <div className="statLbl">{t.invalidAge}</div>
                </div>
              </div>
            </>
          ) : null}

          {/* Technical details toggle */}
          <div className="actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
            <button className="ghostBtn" type="button" onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? t.hideDetails : t.showDetails}
            </button>
          </div>

          {showDetails ? (
            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.20)",
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
{JSON.stringify(resultRaw, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
