// apps/pulse-api/src/services/reports/explainReport/templates.js

const T = {
  ar: {
    title: (signalLabel) => `تقرير تفسيري مبني على التحليل الإحصائي — ${signalLabel}`,
    sections: {
      header: "معلومات التقرير",
      summary: "ملخص مبسّط (لغير المتخصص)",
      what: "ماذا نرى في البيانات؟",
      how: "كيف تم رصد ذلك؟",
      confidence: "مدى الثبات والموثوقية",
      limitations: "ملاحظات وحدود البيانات",
      governance: "حدود الاستخدام",
    },
    common: {
      generatedAt: (d) => `تاريخ الإنشاء: ${d}`,
      facility: (f) => `الجهة/المركز: ${f || "غير محدد"}`,
      range: (r) => `النطاق الزمني: ${r || "غير محدد"}`,
      agg: (a) => `مستوى التجميع: ${a || "أسبوعي"}`,
      methods: (m) => `الطرق المستخدمة: ${m}`,
    },
    status: {
      STABLE: {
        summary:
          "المؤشر ضمن النطاق المتوقع مقارنة بخط الأساس، ولا يظهر انحراف مستمر خلال الفترة المحددة.",
        what:
          "التذبذب الحالي يبدو ضمن الضوضاء الطبيعية، دون نمط تصاعدي متكرر أو انحراف ممتد.",
        confidence:
          "الثبات مرتفع نسبيًا ما لم تكن أحجام العينات الأسبوعية منخفضة أو يوجد نقص بيانات.",
      },
      ATTENTION: {
        summary:
          "هناك ارتفاع فوق خط الأساس في بعض الأسابيع، ويستحسن المتابعة للتأكد إن كان نمطًا عابرًا أم بداية انحراف مستمر.",
        what:
          "لوحظ تغير ملحوظ مقارنة بخط الأساس، لكنه ليس بالضرورة مستمرًا أو قويًا بما يكفي لتصنيفه كإشارة ثابتة.",
        confidence:
          "الثبات متوسط؛ يزداد الاطمئنان إذا استمر النمط عدة أسابيع متتالية مع حجم عينات مناسب.",
      },
      ALERT: {
        summary:
          "تم رصد انحراف مستمر مقارنة بخط الأساس عبر عدة أسابيع متتالية، ما يشير إلى تغير سكاني يستدعي انتباهًا تحليليًا.",
        what:
          "البيانات تُظهر نمطًا متسقًا يتجاوز خط الأساس وليس مجرد تذبذب أسبوعي عابر.",
        confidence:
          "الثبات مرتفع عندما يكون الانحراف ممتدًا ويظهر في أكثر من مؤشر/طريقة وبحجم عينات جيد.",
      },
      INSUFFICIENT: {
        summary:
          "لا تتوفر بيانات كافية لإنتاج تقرير تفسيري موثوق ضمن المعايير المحددة.",
        what:
          "حجم البيانات أو عدد الأسابيع غير كافٍ لاشتقاق خط أساس ومقارنة مستقرة.",
        confidence:
          "يُنصح بتوسيع النطاق الزمني أو التحقق من اكتمال البيانات قبل إعادة التحليل.",
      },
    },
    howLines: {
      ewma:
        "تم استخدام EWMA (متوسط متحرك مرجّح) لرصد التغيرات التدريجية أو المستمرة عبر الزمن.",
      cusum:
        "تم استخدام CUSUM (المجموع التراكمي) لرصد الانحرافات الصغيرة التي تتراكم مع الوقت.",
      farrington:
        "تم استخدام Farrington لمقارنة الأسبوع الحالي بأسابيع مماثلة تاريخيًا (عند توفر تاريخ كافٍ).",
    },
    limitations: (notes) =>
      notes?.length
        ? notes.map((x) => `- ${x}`).join("\n")
        : "- لا توجد ملاحظات إضافية.",
    governance:
      "هذا التقرير يقدم مؤشرات تحليلية على مستوى السكان فقط. لا يشكّل تشخيصًا فرديًا ولا يقدم توصيات علاجية. يلزم تفسيره من قبل مختصين ضمن السياق.",
  },

  en: {
    title: (signalLabel) =>
      `Statistical Explanation Report (Non-technical) — ${signalLabel}`,
    sections: {
      header: "Report info",
      summary: "Plain-language summary",
      what: "What the data shows",
      how: "How this was detected",
      confidence: "Stability & confidence",
      limitations: "Data notes & limitations",
      governance: "Usage boundaries",
    },
    common: {
      generatedAt: (d) => `Generated: ${d}`,
      facility: (f) => `Facility: ${f || "Not specified"}`,
      range: (r) => `Time range: ${r || "Not specified"}`,
      agg: (a) => `Aggregation: ${a || "Weekly"}`,
      methods: (m) => `Methods: ${m}`,
    },
    status: {
      STABLE: {
        summary:
          "The indicator remains within the expected range versus the baseline, with no sustained deviation in the selected period.",
        what:
          "Observed variation looks consistent with normal noise, without a persistent upward pattern.",
        confidence:
          "Confidence is relatively high unless weekly volumes are very small or data is incomplete.",
      },
      ATTENTION: {
        summary:
          "Some weeks appear above the baseline. Monitoring is recommended to confirm whether this is temporary noise or an emerging sustained deviation.",
        what:
          "A noticeable change is present, but it is not yet consistently sustained or strong enough to classify as a stable deviation.",
        confidence:
          "Confidence is moderate; it improves if the pattern persists across multiple consecutive weeks with adequate volume.",
      },
      ALERT: {
        summary:
          "A sustained deviation has been detected across multiple consecutive weeks, indicating a population-level shift that warrants analytical attention.",
        what:
          "The data shows a consistent pattern above baseline beyond typical week-to-week fluctuations.",
        confidence:
          "Confidence is high when the deviation is persistent and supported by more than one method with sufficient weekly volume.",
      },
      INSUFFICIENT: {
        summary:
          "Insufficient data to produce a reliable explanation report for the selected parameters.",
        what:
          "The data volume or number of weeks is too limited to establish a stable baseline comparison.",
        confidence:
          "Consider expanding the time range or verifying data completeness, then re-run the analysis.",
      },
    },
    howLines: {
      ewma:
        "EWMA (Exponentially Weighted Moving Average) was used to detect gradual or sustained shifts over time.",
      cusum:
        "CUSUM (Cumulative Sum) was used to detect small persistent changes that accumulate across weeks.",
      farrington:
        "Farrington was used to compare this week to similar historical weeks (when sufficient history exists).",
    },
    limitations: (notes) =>
      notes?.length
        ? notes.map((x) => `- ${x}`).join("\n")
        : "- No additional notes.",
    governance:
      "This report provides population-level analytical indicators only. It does not diagnose individuals and does not provide treatment guidance. Expert contextual interpretation is required.",
  },
};

module.exports = { T };
