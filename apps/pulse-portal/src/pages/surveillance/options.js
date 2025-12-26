// src/pages/surveillance/options.js

export function getScopeOptions(t) {
  return [
    { value: "global", label: t.modeGlobal },
    { value: "facility", label: t.modeFacility },
    { value: "region", label: t.modeRegion },
  ];
}

export function getTestOptions(t) {
  return [
    { value: "HB", label: t.hb },
    { value: "WBC", label: t.wbc },
    { value: "CRP", label: t.crp },
    { value: "PLT", label: t.plt },
  ];
}

export function getSignalForTest(testCode) {
  if (testCode === "WBC") return "wbc";
  if (testCode === "CRP") return "crp";
  if (testCode === "PLT") return "plt";
  return "anemia";
}

export function getSignalLabel(t, derivedSignal) {
  if (derivedSignal === "wbc") return t.sigWbc;
  if (derivedSignal === "crp") return t.sigCrp;
  if (derivedSignal === "plt") return t.sigPlt;
  return t.sigAnemia;
}
