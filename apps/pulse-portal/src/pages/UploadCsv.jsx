import React, { useMemo, useState } from "react";

const TXT = {
  ar: {
    title: "رفع ملف CSV",
    hint: "ارفع نتائج الفحوصات ليتم إدخالها للنظام (Population-level).",
    choose: "اختر ملف CSV",
    upload: "رفع الملف",
    uploading: "جاري الرفع…",
    ok: "تم رفع الملف بنجاح",
    err: "فشل رفع الملف",
    meta: "تفاصيل الإدخال",
    facility: "رمز المرفق",
    rows: "عدد الصفوف المقروءة",
    accepted: "مقبول",
    rejected: "مرفوض",
    quality: "جودة البيانات",
    missing: "قيم ناقصة",
    invalidDate: "تاريخ غير صالح",
    invalidHb: "Hb غير صالح",
    invalidAge: "عمر غير صالح",
  },
  en: {
    title: "Upload CSV",
    hint: "Upload lab results to ingest into the system (population-level).",
    choose: "Choose CSV file",
    upload: "Upload",
    uploading: "Uploading…",
    ok: "Upload successful",
    err: "Upload failed",
    meta: "Ingest details",
    facility: "Facility ID",
    rows: "Rows parsed",
    accepted: "Accepted",
    rejected: "Rejected",
    quality: "Data quality",
    missing: "Missing values",
    invalidDate: "Invalid date",
    invalidHb: "Invalid Hb",
    invalidAge: "Invalid age",
  },
};

export default function UploadCsv({ lang = "ar", onUploaded }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);
  const isRTL = lang === "ar";

  const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function upload() {
    setError("");
    setResult(null);

    if (!file) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const r = await fetch(`${API}/api/upload/lab-results`, {
        method: "POST",
        body: fd,
      });

      const j = await r.json();

      if (!r.ok || j?.ok === false) {
        throw new Error(j?.error || "Upload failed");
      }

      setResult(j);

      // send summary back to dashboard so it can show indicator + auto-set facilityId
      if (typeof onUploaded === "function") {
        onUploaded({
          facilityId: j?.facilityId ?? null,
          rowsParsed: j?.analysis?.params?.rowsParsed ?? null,
          ingest: j?.data?.ingest ?? null,
          raw: j,
        });
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const summary = result?.data?.ingest?.summary;
  const quality = result?.data?.ingest?.quality;
  const rowsParsed = result?.analysis?.params?.rowsParsed;

  return (
    <div className="card">
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
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button className="primaryBtn" onClick={upload} disabled={busy || !file}>
            {busy ? t.uploading : t.upload}
          </button>
        </div>
      </div>

      {error ? (
        <div className="muted" style={{ marginTop: 12 }} dir={isRTL ? "rtl" : "ltr"}>
          <strong>{t.err}:</strong> {error}
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 12 }} dir={isRTL ? "rtl" : "ltr"}>
          <div className="badge" style={{ marginBottom: 10 }}>{t.ok}</div>

          <div className="muted" style={{ marginBottom: 8 }}>
            <strong>{t.meta}</strong>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="statNum">{result?.facilityId ?? "—"}</div>
              <div className="statLbl">{t.facility}</div>
            </div>
            <div className="stat">
              <div className="statNum">{rowsParsed ?? "—"}</div>
              <div className="statLbl">{t.rows}</div>
            </div>
            <div className="stat">
              <div className="statNum">{summary?.accepted ?? 0}</div>
              <div className="statLbl">{t.accepted}</div>
            </div>
            <div className="stat">
              <div className="statNum">{summary?.rejected ?? 0}</div>
              <div className="statLbl">{t.rejected}</div>
            </div>
          </div>

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
        </div>
      ) : null}
    </div>
  );
}
