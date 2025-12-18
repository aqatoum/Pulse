# PULSE — UI States Standard (Loading / Empty / Error)

## Global Rule
No screen is allowed to show blank space during data operations.
Every data-driven component must have:
- Loading state
- Empty state
- Error state
- Retry capability (when applicable)

---

## 1) Loading State (Mandatory)
### Behavior
- Use skeletons for cards, tables, and charts.
- Show a subtle “Fetching latest data…” message.
- Never block the entire UI unless absolutely necessary.

### Medical-grade guideline
Loading must feel calm and controlled, not “glitchy”.

---

## 2) Empty State (Mandatory)
### When triggered
- API returns ok but no usable data (n=0 or empty arrays).
- Data exists but does not meet minimum aggregation threshold.

### What to display
- Clear message:
  - EN: “No data available for the selected filters.”
  - AR: “لا توجد بيانات متاحة للفلاتر المختارة.”
- Show a short hint:
  - Try expanding date range
  - Try another facility

### Forbidden
- Never show an empty chart with no explanation.
- Never show “undefined / null”.

---

## 3) Error State (Mandatory)
### When triggered
- Network errors
- Server error responses
- Unexpected response shape

### What to display
- Calm error banner (not alarming):
  - EN: “Unable to load data right now.”
  - AR: “تعذر تحميل البيانات حاليًا.”
- Provide:
  - Retry button
  - Optional error code for support (non-technical friendly)

### Logging Rule
- Errors should be logged (client-side) for debugging, without exposing sensitive data.

---

## 4) Report Generation States (Critical)
### Required states
- Idle: “Ready to generate report”
- Generating: progress indicator + “Generating…”
- Ready: “Report is ready” + download button
- Failed: “Report generation failed” + retry

### Forbidden
- No silent failures.
- No “download” button without readiness.

---

## 5) Data Freshness Indicator (Recommended)
Every dashboard must show:
- Last updated timestamp
- Aggregation level (weekly)

---

## Decision Records
(Any state behavior change must be logged here)
