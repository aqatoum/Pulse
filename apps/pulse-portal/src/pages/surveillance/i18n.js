// src/pages/surveillance/i18n.js
export const TXT = {
  ar: {
    title: "منصة PULSE للترصد المختبري السكاني",
    subtitle:
      "مبادرة ابتكار مستقلة ذات بعد وطني لاستخدام إشارات المختبرات الروتينية لدعم الإنذار المبكر وصناعة القرار الصحي على مستوى السكان.",
    note:
      "معلومة: استخدام أكثر من طريقة إحصائية يقوّي القرار النهائي. الحساسية الأعلى قد تلتقط تغيّرات أسرع لكنها قد تزيد الإنذارات الكاذبة.",

    initiativeTitle: "عن المبادرة",
    initiativeBody:
      "تم تطوير هذا النموذج الأولي كمبادرة ابتكار مستقلة بهدف تعزيز ثقافة البيانات والصحة العامة، ودعم الجهود الوطنية في الرصد المبكر عبر تحليل نتائج مختبر روتينية بشكل مجهول الهوية وعلى مستوى السكان.",

    // ✅ FIX: these keys are used by the UI (second info card)
    pilotTitle: "تنبيه منهجي",
    pilotBody:
      "هذا نظام دعم قرار سكاني (Population-level Decision Support) وليس أداة تشخيص فردي. تُفسَّر النتائج بالتنسيق مع الجهات الصحية المختصة وبحسب سياق البيانات وجودتها.",

    // (kept for compatibility if you use them elsewhere)
    unDisclaimerTitle: "تنبيه منهجي",
    unDisclaimerBody:
      "هذا نظام دعم قرار سكاني (Population-level Decision Support) وليس أداة تشخيص فردي. تُفسَّر النتائج بالتنسيق مع الجهات الصحية المختصة وبحسب سياق البيانات وجودتها.",

    footerLine1: "مبادرة ابتكار مستقلة ذات بعد وطني",
    footerLine2: "نموذج تجريبي لتعزيز الترصد المبكر وصناعة القرار الصحي",
    footerLine3: "© PULSE (Prototype) — للاستخدام التجريبي/البحثي",

    scope: "نطاق التحليل",
    modeGlobal: "وطني (كل البيانات)",
    modeFacility: "مرفق صحي",
    modeRegion: "منطقة",

    facility: "رمز المرفق",
    region: "رمز المنطقة",
    lab: "رمز المختبر (اختياري)",

    placeholderFacility: "مثال: AMMAN-JUBEIHA-PHC (اختياري)",
    placeholderRegion: "مثال: AMMAN_NORTH (اختياري)",
    placeholderLab: "مثال: LAB-01",

    test: "الفحص",
    hb: "Hb (فقر دم)",
    wbc: "WBC (كريات بيضاء)",
    crp: "CRP (التهاب)",
    plt: "PLT (صفائح)",

    signal: "الإشارة",
    signalHint: "الإشارة تُحدد تلقائيًا بناءً على الفحص المختار (مثال: Hb ⇢ Anemia).",
    sigAnemia: "Anemia (Low Hb rate)",
    sigWbc: "WBC deviation (High WBC rate)",
    sigCrp: "Inflammation (High CRP rate)",
    sigPlt: "Platelets deviation (Low PLT rate)",

    analysisNoteTitle: "ملاحظة",
    analysisNoteBody: "سيتم تطبيق التحليل على الإشارة المختارة أعلاه.",

    methods: "الطرق الإحصائية",
    run: "تشغيل التحليل",
    report: "نسخ التقرير",
    copied: "تم النسخ ✅",

    dataset: "مصدر البيانات",
    aggregation: "التجميع",

    timeFilter: "فلتر الزمن",
    startDate: "بداية",
    endDate: "نهاية",
    clearDates: "مسح التواريخ",

    sensitivity: "الحساسية",
    presetLow: "منخفضة",
    presetStandard: "قياسية",
    presetHigh: "عالية",

    advanced: "إعدادات متقدمة",
    advancedOn: "تفعيل الإعدادات المتقدمة",
    advancedOff: "إيقاف المتقدمة (رجوع للـ Preset)",
    advancedHint:
      "الإعدادات المتقدمة تسمح بضبط حساسية كل طريقة بدقة أكبر. جميع القيم مقيّدة بحدود آمنة (Bounds) لمنع إعدادات غير منطقية.",

    ewmaBlock: "EWMA",
    cusumBlock: "CUSUM",
    farringtonBlock: "Farrington",

    paramLambda: "Lambda (EWMA)",
    paramL: "L (EWMA)",
    paramEwmaBaselineN: "Baseline weeks (EWMA)",
    paramCusumBaselineN: "Baseline weeks (CUSUM)",
    paramK: "k (CUSUM)",
    paramH: "h (CUSUM)",
    paramFarrBaseline: "Baseline weeks (Farrington)",
    paramZ: "z (Farrington)",

    resetToPreset: "إعادة ضبط لقيم الـ Preset",

    hintLambda: "Lambda أعلى = استجابة أسرع للتغيرات الحديثة (حساسية أعلى). أقل = سلاسة أكثر (حساسية أقل).",
    hintL: "L أكبر = حد أعلى أعلى (أقل حساسية). L أصغر = حد أقل (أكثر حساسية).",
    hintBaselineN: "Baseline أكبر = مرجع تاريخي أوسع (استقرار أعلى). أصغر = مرجع أقل (قد يزيد التذبذب).",
    hintK: "k أصغر = حساسية أكبر لتغيرات صغيرة. k أكبر = يتطلب تغير أكبر ليبدأ التراكم.",
    hintH: "h أصغر = إنذار أسرع (حساسية أعلى). h أكبر = يتطلب تراكم أكبر.",
    hintFarrBaseline: "BaselineWeeks أكبر = مقارنة مع تاريخ أطول. أصغر = استجابة أسرع لكن أقل ثباتًا.",
    hintZ: "z أصغر = حد أقل (حساسية أعلى). z أكبر = حد أعلى (حساسية أقل).",

    methodsUsed: "الطرق المستخدمة",
    lastUpdated: "آخر تحديث",
    notAvailable: "غير متاح",

    empty: "لا توجد بيانات بعد.",
    insufficient: "لا توجد بيانات كافية لإنشاء تقرير واضح ضمن النطاق المحدد.",

    uploadTitle: "رفع ملف CSV (نتائج مختبر)",
    upload: "رفع",
    uploading: "جاري الرفع…",
    uploadOk: "تم رفع الملف بنجاح",

    uploadMeta: "معلومات الملف",
    fileName: "الملف",
    fileSize: "الحجم",
    serverSummary: "ملخص السيرفر",

    error: "تعذر تحميل البيانات حاليًا.",
    retry: "إعادة المحاولة",

    statusCardTitle: "الحالة الحالية (Status)",
    status: "الحالة",
    trend: "الاتجاه",
    confidence: "الثقة",

    scopeLabel: "النطاق",
    testLabel: "الفحص",
    signalLabel: "الإشارة",

    why: "لماذا؟",
    actions: "التوصيات",

    viewDetails: "عرض التفاصيل التقنية",
    hideDetails: "إخفاء التفاصيل",

    info: "طبيعي",
    watch: "مراقبة",
    alert: "إنذار",

    trendUp: "تصاعدي",
    trendDown: "انخفاض",
    trendFlat: "مستقر",
    trendNoData: "غير كافٍ",

    confLow: "منخفضة",
    confMed: "متوسطة",
    confHigh: "عالية",

    strat: "التقسيم السكاني",
    narrative: "التقرير السردي",

    chartsTitle: "تفاصيل الطرق الإحصائية",
    chartsHint:
      "هذه الرسوم موجّهة للمختصين. الخط المتقطع يمثل الحد الإحصائي. الدائرة الفارغة تعني نقطة إنذار.",

    totalSamples: "إجمالي العينات",
    signalRate: "معدل الإشارة",
    cases: "الحالات",

    bySex: "حسب الجنس",
    byAge: "حسب العمر",
    byNationality: "حسب الجنسية",

    requiredFacility: "الرجاء إدخال رمز المرفق عند اختيار (مرفق صحي).",
    requiredRegion: "الرجاء إدخال رمز المنطقة عند اختيار (منطقة).",
  },

  en: {
    title: "PULSE Population Laboratory Surveillance",
    subtitle:
      "An independent innovation initiative with national relevance, using routine laboratory signals to support early warning and population-level public health decision-making.",
    note:
      "Tip: using multiple methods strengthens the final decision. Higher sensitivity may detect changes earlier but can increase false alerts.",

    initiativeTitle: "About the initiative",
    initiativeBody:
      "This prototype was developed as an independent innovation initiative to support data-informed public health, using de-identified routine laboratory results and population-level analytics.",

    // ✅ FIX: these keys are used by the UI (second info card)
    pilotTitle: "Methodological notice",
    pilotBody:
      "This is population-level decision support, not individual diagnosis. Interpret results with public health stakeholders and in light of data quality and context.",

    // (kept for compatibility)
    unDisclaimerTitle: "Methodological notice",
    unDisclaimerBody:
      "This is population-level decision support, not individual diagnosis. Interpret results with public health stakeholders and in light of data quality and context.",

    footerLine1: "Independent innovation initiative with national relevance",
    footerLine2: "Pilot prototype to strengthen early warning and public health decision-making",
    footerLine3: "© PULSE (Prototype) — Research/Pilot use",

    scope: "Scope",
    modeGlobal: "National (all data)",
    modeFacility: "Facility",
    modeRegion: "Region",

    facility: "Facility code",
    region: "Region code",
    lab: "Lab code (optional)",

    placeholderFacility: "e.g., AMMAN-JUBEIHA-PHC (optional)",
    placeholderRegion: "e.g., AMMAN_NORTH (optional)",
    placeholderLab: "e.g., LAB-01",

    test: "Test",
    hb: "Hb (Anemia)",
    wbc: "WBC (White Blood Cells)",
    crp: "CRP (Inflammation)",
    plt: "PLT (Platelets)",

    signal: "Signal",
    signalHint: "Signal is auto-selected based on the chosen test (e.g., Hb ⇢ Anemia).",
    sigAnemia: "Anemia (Low Hb rate)",
    sigWbc: "WBC deviation (High WBC rate)",
    sigCrp: "Inflammation (High CRP rate)",
    sigPlt: "Platelets deviation (Low PLT rate)",

    analysisNoteTitle: "Note",
    analysisNoteBody: "Analysis will run on the selected signal above.",

    methods: "Statistical methods",
    run: "Run analysis",
    report: "Copy report",
    copied: "Copied ✅",

    dataset: "Dataset",
    aggregation: "Aggregation",

    timeFilter: "Time filter",
    startDate: "Start",
    endDate: "End",
    clearDates: "Clear dates",

    sensitivity: "Sensitivity",
    presetLow: "Low",
    presetStandard: "Standard",
    presetHigh: "High",

    advanced: "Advanced settings",
    advancedOn: "Enable advanced",
    advancedOff: "Disable advanced (use preset)",
    advancedHint: "Advanced lets you tune each method’s sensitivity. Values are clamped to safe bounds.",

    ewmaBlock: "EWMA",
    cusumBlock: "CUSUM",
    farringtonBlock: "Farrington",

    paramLambda: "Lambda (EWMA)",
    paramL: "L (EWMA)",
    paramEwmaBaselineN: "Baseline weeks (EWMA)",
    paramCusumBaselineN: "Baseline weeks (CUSUM)",
    paramK: "k (CUSUM)",
    paramH: "h (CUSUM)",
    paramFarrBaseline: "Baseline weeks (Farrington)",
    paramZ: "z (Farrington)",

    resetToPreset: "Reset to preset values",

    hintLambda:
      "Higher lambda reacts faster to recent changes (more sensitive). Lower is smoother (less sensitive).",
    hintL:
      "Higher L increases the control limit (less sensitive). Lower L makes alerts easier (more sensitive).",
    hintBaselineN:
      "Larger baseline means a more stable historical reference. Smaller may be noisier.",
    hintK:
      "Smaller k is more sensitive to small shifts. Larger k needs a bigger shift to accumulate.",
    hintH:
      "Smaller h triggers earlier (more sensitive). Larger h requires more accumulation.",
    hintFarrBaseline:
      "Larger baselineWeeks compares against longer history. Smaller reacts faster but less stable.",
    hintZ:
      "Smaller z lowers the threshold (more sensitive). Larger z raises it (less sensitive).",

    methodsUsed: "Methods used",
    lastUpdated: "Last updated",
    notAvailable: "N/A",

    empty: "No data yet.",
    insufficient: "Not enough data to generate a clear report within the selected scope.",

    uploadTitle: "Upload CSV (Lab Results)",
    upload: "Upload",
    uploading: "Uploading…",
    uploadOk: "Upload successful",

    uploadMeta: "Upload info",
    fileName: "File",
    fileSize: "Size",
    serverSummary: "Server summary",

    error: "Unable to load data right now.",
    retry: "Retry",

    statusCardTitle: "Current status",
    status: "Status",
    trend: "Trend",
    confidence: "Confidence",

    scopeLabel: "Scope",
    testLabel: "Test",
    signalLabel: "Signal",

    why: "Why?",
    actions: "Actions",

    viewDetails: "View technical details",
    hideDetails: "Hide details",

    info: "Normal",
    watch: "Watch",
    alert: "Alert",

    trendUp: "Rising",
    trendDown: "Falling",
    trendFlat: "Stable",
    trendNoData: "Insufficient",

    confLow: "Low",
    confMed: "Medium",
    confHigh: "High",

    strat: "Population stratification",
    narrative: "Narrative report",

    chartsTitle: "Statistical method details",
    chartsHint:
      "These charts are for technical review. The dashed line is the statistical threshold. Hollow circles mark alert points.",

    totalSamples: "Total samples",
    signalRate: "Signal rate",
    cases: "Cases",

    bySex: "By sex",
    byAge: "By age",
    byNationality: "By nationality",

    requiredFacility: "Please enter a facility code when Scope=Facility.",
    requiredRegion: "Please enter a region code when Scope=Region.",
  },
};
