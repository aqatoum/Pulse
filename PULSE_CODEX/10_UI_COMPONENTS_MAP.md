# PULSE — UI Components Map

## Screen 1 — Overview Dashboard

### Global Components
- App Header
  - Logo
  - Global Language Toggle (AR / EN)
  - Global Time Range Selector
- Main Navigation

### Dashboard Components
- Signal Summary Card
  - Signal name
  - Current status (stable / attention / alert)
  - Short contextual hint
- System Status Banner
  - Overall system state
  - Last data update timestamp

---

## Screen 2 — Signal Detail View

### Analytical Components
- Signal Header
  - Signal name
  - Selected facility / region
  - Time range
- Time-Series Chart
  - Observed metric
  - Baseline reference
  - Threshold / control limits
- Model Output Panel
  - EWMA indicators
  - CUSUM indicators
  - Farrington indicators
- Stratification Controls
  - Age group selector
  - Sex selector

### Explanation Components
- Plain Language Explanation Box
- Methodology Tooltip (on demand)

---

## Screen 3 — Spatial Context (Phase 2)

### Visualization Components
- Geographic Aggregation Map
- Signal Intensity Legend
- Temporal Slider

---

## Screen 4 — Reports & Exports

### Reporting Components
- Narrative Report Panel
- Aggregated Data Table
- Export Controls
  - PDF
  - Image

### Status Indicators
- Report generation status
- Download readiness indicator

---

## Screen 5 — System Context & Methodology

### Transparency Components
- Methods Overview Section
- Data Scope & Limitations Panel
- Ethics & Governance Summary

---

## Reusable Core Components (System-Wide)
- Loading Skeleton
- Empty State Message
- Error State Message
- Tooltip / Info Icon
- Confirmation Dialog

---

## Component Rules
- Every component must have a clear purpose.
- No component is added without a mapped screen.
- Reusable components are preferred over screen-specific ones.

## Decision Records
(Any component change must be logged here)
