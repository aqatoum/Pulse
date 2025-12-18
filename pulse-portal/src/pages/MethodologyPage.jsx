import React, { useMemo } from "react";

const TXT = {
  ar: {
    title: "المنهجية العلمية",
    intro:
      "يعتمد نظام PULSE على مراقبة إحصائية سكانية متعددة الطبقات لاكتشاف الانحرافات المبكرة في نتائج الفحوصات المخبرية على مستوى المجتمع، وليس لتشخيص الأفراد.",
    data: "1) البيانات",
    dataTxt:
      "يتم إدخال نتائج الفحوصات من CSV أو من أنظمة المختبر، مع التحقق من الجودة (القيم المفقودة، تواريخ غير صالحة، قيم Hb غير منطقية).",
    methods: "2) الطرق الإحصائية",
    methodsTxt:
      "تُستخدم خوارزميات مراقبة معروفة عالميًا: EWMA لاكتشاف الانحرافات التدريجية، CUSUM للتغيرات الصغيرة المستمرة، وFarrington للتنبؤ بالمتوقع ومقارنته بالمشاهد.",
    ensemble: "3) التجميع (Ensemble)",
    ensembleTxt:
      "يتم دمج نتائج الطرق في قرار إجماعي يقلل الإنذارات الكاذبة ويزيد الثبات والموثوقية.",
    strat: "4) التقسيم السكاني",
    stratTxt:
      "تحليل حسب العمر/الجنس لتحديد الفئات الأكثر تأثرًا وتوجيه التدخلات (تغذية/تثقيف/متابعة) بشكل أدق.",
    output: "5) المخرجات",
    outputTxt:
      "تقارير سردية مفهومة للجان وصناع القرار، مع توصيات عملية مبنية على البيانات.",
    disclaimer:
      "تنويه: هذا النظام أداة دعم قرار سكاني ولا يُستخدم لتشخيص الحالات الفردية.",
  },
  en: {
    title: "Scientific Methodology",
    intro:
      "PULSE implements a multi-layer population-level statistical surveillance approach to detect early deviations in laboratory results. It is not intended for individual diagnosis.",
    data: "1) Data",
    dataTxt:
      "Laboratory results are ingested from CSV or lab systems with systematic quality checks (missingness, invalid dates, out-of-range Hb values).",
    methods: "2) Statistical Methods",
    methodsTxt:
      "Internationally recognized algorithms are applied: EWMA for gradual drifts, CUSUM for persistent small shifts, and Farrington-style expected-vs-observed alerting.",
    ensemble: "3) Ensemble Decision",
    ensembleTxt:
      "Multiple method outputs are combined into a single consensus decision to reduce false alarms and improve robustness.",
    strat: "4) Population Stratification",
    stratTxt:
      "Stratification by age/sex helps identify vulnerable subgroups and supports targeted interventions.",
    output: "5) Outputs",
    outputTxt:
      "Committee-friendly narrative reports and actionable recommendations based on the data.",
    disclaimer:
      "Disclaimer: This is a population-level decision-support tool and must not be used for individual medical diagnosis.",
  },
};

export default function MethodologyPage({ lang = "ar" }) {
  const t = useMemo(() => TXT[lang] || TXT.en, [lang]);

  return (
    <div className="panel">
      <div className="panelHeader">
        <div className="panelTitle">{t.title}</div>
      </div>

      <div className="methodology">
        <p className="methodIntro">{t.intro}</p>

        <h4>{t.data}</h4>
        <p>{t.dataTxt}</p>

        <h4>{t.methods}</h4>
        <p>{t.methodsTxt}</p>

        <h4>{t.ensemble}</h4>
        <p>{t.ensembleTxt}</p>

        <h4>{t.strat}</h4>
        <p>{t.stratTxt}</p>

        <h4>{t.output}</h4>
        <p>{t.outputTxt}</p>

        <div className="methodDisclaimer">{t.disclaimer}</div>
      </div>
    </div>
  );
}
