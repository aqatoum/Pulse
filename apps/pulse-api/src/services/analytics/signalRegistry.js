const signals = {
  anemia: {
    id: "anemia",
    category: "micronutrient_deficiency",
    biomarker: "Hemoglobin (Hb)",
    unit: "g/dL",

    description: {
      en: "Population-level signal indicating a potential increase in anemia prevalence.",
      ar: "إشارة على مستوى السكان تشير إلى احتمال ارتفاع معدل فقر الدم."
    },

    publicHealthRelevance: {
      en: "Anemia affects physical development, cognitive performance, and maternal health.",
      ar: "فقر الدم يؤثر على النمو الجسدي، الأداء المعرفي، وصحة الأمهات."
    },

    defaultActions: {
      info: {
        en: [
          "Continue routine monitoring.",
          "Ensure data completeness and quality."
        ],
        ar: [
          "الاستمرار في المراقبة الدورية.",
          "التأكد من اكتمال وجودة البيانات."
        ]
      },
      watch: {
        en: [
          "Review recent laboratory trends.",
          "Assess nutritional programs in the area."
        ],
        ar: [
          "مراجعة الاتجاهات المخبرية الحديثة.",
          "تقييم برامج التغذية في المنطقة."
        ]
      },
      alert: {
        en: [
          "Initiate targeted epidemiological assessment.",
          "Coordinate with public health and nutrition stakeholders."
        ],
        ar: [
          "بدء تقييم وبائي موجه.",
          "التنسيق مع الجهات الصحية وبرامج التغذية."
        ]
      }
    }
  }
};

function getSignal(signalType) {
  return signals[signalType] || null;
}

module.exports = { getSignal };
