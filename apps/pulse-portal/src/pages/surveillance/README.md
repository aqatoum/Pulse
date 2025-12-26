# PULSE – Surveillance Module | وحدة المراقبة الوبائية

---

## العربية 🇦🇪

### نظرة عامة
هذا المجلد يحتوي على وحدة لوحة المراقبة الوبائية ضمن مشروع PULSE.
تم تقسيم الملفات لفصل الترجمة والمنطق والأدوات والمكوّنات لتسهيل الصيانة والتطوير.

### هيكل المجلد
- i18n.js: النصوص والترجمة (عربي/إنجليزي)
- constants.js: Presets و Bounds
- options.js: خيارات النطاق والفحوصات والإشارات
- utils.js: أدوات عامة (تنسيق/تواريخ/طلبات API)
- strat.utils.js: أدوات التقسيم السكاني
- charts.adapters.js: تهيئة بيانات الرسوم البيانية
- components/: مكوّنات الواجهة (Dropdown, ParamSlider)
- index.js: ملف تصدير مركزي

### تنبيه مهم
هذه الوحدة لدعم القرار على مستوى السكان وليست للتشخيص الفردي.

---

## English 🇬🇧

### Overview
This folder contains the Surveillance Dashboard module of the PULSE project.
Files are organized to separate localization, logic, utilities, and UI components for maintainability.

### Folder contents
- i18n.js: Localization (AR/EN)
- constants.js: Presets and safe bounds
- options.js: Scope/test/signal options
- utils.js: Common helpers (formatting/dates/API calls)
- strat.utils.js: Stratification helpers
- charts.adapters.js: Backend → chart data adapters
- components/: UI components (Dropdown, ParamSlider)
- index.js: Central exports

### Important notice
This module supports population-level decision-making and is not an individual diagnostic tool.
