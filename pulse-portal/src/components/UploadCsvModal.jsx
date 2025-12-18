import React, { useMemo, useState } from "react";

const TXT = {
  ar: {
    title: "رفع CSV",
    hint: "ارفع ملف lab_results.csv ثم شغّل التحليل من لوحة المراقبة.",
    choose: "اختر ملف CSV",
    upload: "رفع الملف",
    ok: "تم الرفع بنجاح",
    fail: "فشل الرفع",
    fileName: "اسم الملف",
    rows: "عدد الصفوف",
    total: "الإجمالي",
    accepted: "مقبول",
    rejected: "مرفوض",
    facility: "Facility",
    close: "إغلاق",
  },
  en: {
    title: "Upload CSV",
    hint: "Upload lab_results.csv then run analytics from the dashboard.",
    choose: "Choose CSV",
    upload: "Upload",
    ok: "Upload successful",
    fail: "Upload failed",
    fileName: "File name",
    rows: "Rows parsed",
    total: "Total",
    accepted: "Accepted",
    rejected: "Rejected",
    facility: "Facility",
    close: "Close",
  },
};

export default function UploadCsvModal({ open, onClose, lang = "ar", apiBase, onUploaded }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);

  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");

  async function uploadCsv() {
    if (!csvFile) return;

    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const fd = new FormData();
      fd.append("file", csvFile);

      const r = await fetch(`${apiBase}/api/upload/lab-results`, {
        method: "POST",
        body: fd,
      });

      const j = await r.json();

      if (!j?.ok) {
        setUploadError(j?.error || t.fail);
        setUploadResult(null);
      } else {
        setUploadResult(j);
        const facilityId = j?.facilityId || null;
        onUploaded?.(j, facilityId);
      }
    } catch (e) {
      setUploadError(String(e?.message || e));
      setUploadResult(null);
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">{t.title}</div>
            <div className="modalHint">{t.hint}</div>
          </div>
          <button className="ghostBtn" onClick={onClose}>{t.close}</button>
        </div>

        <div className="formRow">
          <div className="field" style={{ flex: 1 }}>
            <label>{t.choose}</label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
          </div>
          <div className="actions" style={{ alignSelf: "end" }}>
            <button className="primaryBtn" onClick={uploadCsv} disabled={uploading || !csvFile}>
              {uploading ? "…" : t.upload}
            </button>
          </div>
        </div>

        {uploadError ? (
          <div className="callout calloutBad">{t.fail}: {uploadError}</div>
        ) : null}

        {uploadResult?.ok ? (
          <div className="callout calloutOk">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{t.ok}</div>

            <div className="kv">
              <div><b>{t.facility}:</b> {uploadResult?.facilityId || "-"}</div>
              <div><b>{t.fileName}:</b> {uploadResult?.analysis?.params?.fileName || "-"}</div>
              <div><b>{t.rows}:</b> {uploadResult?.analysis?.params?.rowsParsed ?? "-"}</div>
              <div><b>{t.total}:</b> {uploadResult?.data?.ingest?.summary?.total ?? "-"}</div>
              <div><b>{t.accepted}:</b> {uploadResult?.data?.ingest?.summary?.accepted ?? "-"}</div>
              <div><b>{t.rejected}:</b> {uploadResult?.data?.ingest?.summary?.rejected ?? "-"}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
