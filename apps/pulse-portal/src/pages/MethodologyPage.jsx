import React, { useMemo } from "react";

const TXT = {
  ar: {
    title: "المنهجية العلمية",
    intro:
      "يعتمد نظام PULSE على إطار تحليلي إحصائي سكاني (Population-level Analytical Framework) يهدف إلى رصد الانحرافات المبكرة في الإشارات المخبرية الروتينية على مستوى المجتمع. يعمل النظام كطبقة تحليلية داعمة للقرار، ولا يُستخدم للتشخيص الفردي أو اتخاذ قرارات سريرية.",

    data: "1) مصادر البيانات ونطاق التحليل",
    dataTxt:
      "يعالج النظام بيانات فحوصات مخبرية روتينية مُجمَّعة (مثل CBC) يتم إدخالها من ملفات CSV أو من أنظمة المختبر القائمة. تُطبّق عمليات تحقق جودة صارمة تشمل سلامة التواريخ، اكتمال القيم، واتساق النطاقات المرجعية، مع إزالة أي مُعرِّفات شخصية قبل التحليل.",

    methods: "2) نماذج الرصد الإحصائي",
    methodsTxt:
      "يستخدم PULSE نماذج رصد إحصائية معتمدة عالميًا في الصحة العامة: EWMA لاكتشاف الانحرافات التدريجية، CUSUM لرصد التغيرات الصغيرة المستمرة، ونموذج Farrington لمقارنة القيم المرصودة بالتوقعات التاريخية. تعمل هذه النماذج كخطوط أساس تفسيرية قابلة للتدقيق.",

    ensemble: "3) منطق الدمج والتحقق (Hybrid Decision Logic)",
    ensembleTxt:
      "تُدمج مخرجات النماذج المختلفة ضمن منطق قرار تجميعي يقيّم التوافق والاستمرارية عبر الزمن، بهدف تقليل الإنذارات الكاذبة وزيادة ثبات الإشارة دون الاعتماد على نموذج واحد.",

    strat: "4) التقسيم السكاني والتحليل السياقي",
    stratTxt:
      "تُحلَّل الإشارات على مستوى الفئات السكانية (العمر، الجنس) لتمييز الأنماط غير المتجانسة داخل المجتمع، ودعم التفسير التحليلي الموجّه على مستوى السكان.",

    output: "5) المخرجات ودعم القرار",
    outputTxt:
      "ينتج النظام مؤشرات تحليلية وتقارير سردية واضحة موجّهة للجان والخبراء وصنّاع القرار، تركّز على وصف ما يحدث على مستوى السكان، دون تقديم تشخيص أو توصيات علاجية.",

    disclaimer:
      "تنويه منهجي: PULSE نظام دعم قرار سكاني تحليلي، ولا يُستخدم لتشخيص الحالات الفردية أو تقديم إرشادات طبية."
  },

  en: {
    title: "Scientific Methodology",
    intro:
      "PULSE operates as a population-level analytical framework designed to detect early deviations in routine laboratory signals. The system functions as a decision-support overlay and is not intended for individual diagnosis or clinical decision-making.",

    data: "1) Data Sources and Analytical Scope",
    dataTxt:
      "The system processes aggregated routine laboratory data (e.g., CBC) ingested from CSV files or existing laboratory systems. Rigorous quality checks are applied, including validation of timestamps, completeness, and reference consistency. All personal identifiers are removed prior to analysis.",

    methods: "2) Statistical Surveillance Models",
    methodsTxt:
      "PULSE applies internationally validated public-health surveillance methods: EWMA for gradual signal drift, CUSUM for persistent small shifts, and the Farrington approach for expected-versus-observed deviation detection. These models provide transparent and auditable analytical baselines.",

    ensemble: "3) Hybrid Decision Logic",
    ensembleTxt:
      "Outputs from multiple models are integrated using a hybrid consensus logic that evaluates agreement and persistence over time. This approach improves robustness and reduces false alerts without relying on a single detection method.",

    strat: "4) Population Stratification and Contextual Analysis",
    stratTxt:
      "Signals are examined across population subgroups (age and sex) to identify heterogeneous patterns and support targeted analytical interpretation at the population level.",

    output: "5) Outputs and Decision Support",
    outputTxt:
      "The system produces clear analytical indicators and narrative reports tailored for expert committees and decision-makers, focusing on population-level trends rather than individual outcomes.",

    disclaimer:
      "Disclaimer: PULSE is a population-level analytical decision-support system and must not be used for individual medical diagnosis or treatment decisions."
  }
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
