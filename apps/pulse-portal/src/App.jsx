import React, { useEffect, useMemo, useState } from "react";
import SurveillanceDashboard from "./pages/SurveillanceDashboard.jsx";
import MethodologyPage from "./pages/MethodologyPage.jsx";
import UploadCsvModal from "./components/UploadCsvModal.jsx";

const TXT = {
  ar: {
    portal: "بوابة PULSE",
    sub: "Population Laboratory Surveillance Engine",
    dashboard: "لوحة المراقبة",
    methodology: "المنهجية",
    upload: "رفع CSV",
    lang: "English",
    mvp: "MVP",
    footer: "تحليلات داعمة للقرار (وليست تشخيصًا فرديًا)",
  },
  en: {
    portal: "PULSE Portal",
    sub: "Population Laboratory Surveillance Engine",
    dashboard: "Dashboard",
    methodology: "Methodology",
    upload: "Upload CSV",
    lang: "العربية",
    mvp: "MVP",
    footer: "Decision-support analytics (not individual diagnosis)",
  },
};

const LANG_STORAGE_KEY = "pulse_lang";

export default function App() {
  const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  // 1) اقرأ اللغة من التخزين (بدون ما تغيّر تصميمك)
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === "en" || saved === "ar" ? saved : "ar";
  });

  const isRTL = lang === "ar";
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);

  const [page, setPage] = useState("dashboard"); // "dashboard" | "methodology"
  const [uploadOpen, setUploadOpen] = useState(false);

  const [facilityFromUpload, setFacilityFromUpload] = useState(null);
  const [datasetReady, setDatasetReady] = useState(false);

  function toggleLang() {
    setLang((p) => (p === "ar" ? "en" : "ar"));
  }

  function onUploaded(_result, facilityId) {
    if (facilityId) {
      setFacilityFromUpload(facilityId);
      setDatasetReady(true);
    } else {
      setDatasetReady(true);
    }
  }

  // 2) اجعل اللغة والاتجاه “Global” على مستوى <html> (هذا أهم شيء)
  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
  }, [lang, isRTL]);

  return (
    <div className="app" dir={isRTL ? "rtl" : "ltr"}>
      <header className="topbar">
        <div className="brand">
          <div className="logo">P</div>
          <div>
            <div className="brandTitle">{t.portal}</div>
            <div className="brandSub">{t.sub}</div>
          </div>
        </div>

        <div className="topbarRight">
          <button
            className={`chipBtn ${page === "dashboard" ? "chipBtnOn" : ""}`}
            onClick={() => setPage("dashboard")}
          >
            {t.dashboard}
          </button>

          <button
            className={`chipBtn ${page === "methodology" ? "chipBtnOn" : ""}`}
            onClick={() => setPage("methodology")}
          >
            {t.methodology}
          </button>

          <button className="ghostBtn" onClick={() => setUploadOpen(true)}>
            {t.upload}
            {datasetReady ? " ✓" : ""}
          </button>

          {/* زر اللغة الوحيد في النظام */}
          <button className="primaryBtn" onClick={toggleLang} aria-label="Global language toggle">
            {t.lang}
          </button>

          <span className="badge">{t.mvp}</span>
        </div>
      </header>

      <main className="container">
        {page === "dashboard" ? (
          <SurveillanceDashboard lang={lang} apiBase={API} facilityPreset={facilityFromUpload} />
        ) : (
          <MethodologyPage lang={lang} />
        )}
      </main>

      <footer className="footer">
        <span>© {new Date().getFullYear()} PULSE</span>
        <span className="dot">•</span>
        <span>{t.footer}</span>
      </footer>

      <UploadCsvModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        lang={lang}
        apiBase={API}
        onUploaded={onUploaded}
      />
    </div>
  );
}
