// src/pages/surveillance/index.js

export { TXT } from "./i18n.js";
export { PRESETS, BOUNDS } from "./constants.js";

export {
  getScopeOptions,
  getTestOptions,
  getSignalForTest,
  getSignalLabel,
} from "./options.js";

export {
  upper,
  safeText,
  clampNum,
  clampInt,
  toNum,
  normalizeRate,
  fmtPct,
  fmtBytes,
  extractDateRange,
  extractReport,
  fetchJSON,
  postFile,
  normalizeDateRange,
} from "./utils.js";

export {
  pickRate,
  pickCases,
  keyLabelSex,
  safeLabel,
  fmtPct as fmtPctStrat,
  barWidth,
} from "./strat.utils.js";

export { adaptEWMA, adaptCUSUM, adaptFarrington } from "./charts.adapters.js";

export { default as Dropdown } from "./components/Dropdown.jsx";
export { default as ParamSlider } from "./components/ParamSlider.jsx";

// (اختياري لاحقاً)
// export { default as StratCard } from "./components/StratCard.jsx";
// export { default as Stratification } from "./components/Stratification.jsx";
