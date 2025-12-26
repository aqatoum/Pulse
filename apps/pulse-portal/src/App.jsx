import React, { useEffect, useMemo, useState } from "react";
import SurveillanceDashboard from "./pages/SurveillanceDashboard.jsx";
import MethodologyPage from "./pages/MethodologyPage.jsx";

const TXT = {
  ar: {
    portal: "بوابة PULSE",
    sub: "Population Laboratory Surveillance Engine",
    dashboard: "لوحة المراقبة",
    methodology: "المنهجية",
    lang: "English",
    mvp: "MVP",
    footer: "تحليلات داعمة للقرار (وليست تشخيصًا فرديًا)",
  },
  en: {
    portal: "PULSE Portal",
    sub: "Population Laboratory Surveillance Engine",
    dashboard: "Dashboard",
    methodology: "Methodology",
    lang: "العربية",
    mvp: "MVP",
    footer: "Decision-support analytics (not individual diagnosis)",
  },
};

const LANG_STORAGE_KEY = "pulse_lang";

export default function App() {
  const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  // اللغة
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === "en" || saved === "ar" ? saved : "ar";
  });

  const isRTL = lang === "ar";
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);

  const [page, setPage] = useState("dashboard"); // dashboard | methodology

  function toggleLang() {
    setLang((p) => (p === "ar" ? "en" : "ar"));
  }

  // ضبط الاتجاه واللغة على مستوى الصفحة
  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
  }, [lang, isRTL]);

  return (
    <div className="app" dir={isRTL ? "rtl" : "ltr"}>
      {/* ===== Top Bar ===== */}
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

          {/* زر اللغة */}
          <button
            className="primaryBtn"
            onClick={toggleLang}
            aria-label="Global language toggle"
          >
            {t.lang}
          </button>

          <span className="badge">{t.mvp}</span>
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="container">
        {page === "dashboard" ? (
          <SurveillanceDashboard lang={lang} apiBase={API} />
        ) : (
          <MethodologyPage lang={lang} />
        )}
      </main>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <span>© {new Date().getFullYear()} PULSE</span>
        <span className="dot">•</span>
        <span>{t.footer}</span>
      </footer>
    </div>
  );
}
