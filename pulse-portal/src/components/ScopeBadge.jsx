import React from "react";

function normalizeScope(scope, legacyFacilityId) {
  // scope from backend
  if (scope?.type && scope?.id) return scope;

  // backward compat (لو واجهتك استجابة قديمة)
  if (legacyFacilityId) {
    return { type: "FACILITY", id: legacyFacilityId };
  }

  return { type: "UNKNOWN", id: "" };
}

export default function ScopeBadge({ scope, facilityId, lang = "ar", compact = false }) {
  const s = normalizeScope(scope, facilityId);

  const isRegion = s.type === "REGION";
  const isFacility = s.type === "FACILITY";

  const label =
    lang === "ar"
      ? isRegion
        ? "المنطقة"
        : isFacility
        ? "المرفق"
        : "النطاق"
      : isRegion
      ? "Region"
      : isFacility
      ? "Facility"
      : "Scope";

  const value = s.id ? s.id : (lang === "ar" ? "غير محدد" : "N/A");

  return (
    <div className={`scopeBadge ${compact ? "scopeBadgeCompact" : ""} ${isRegion ? "scopeRegion" : isFacility ? "scopeFacility" : "scopeUnknown"}`}>
      <span className="scopeDot" />
      <span className="scopeLabel">{label}</span>
      <span className="scopeSep">•</span>
      <span className="scopeValue" title={value}>{value}</span>
    </div>
  );
}
