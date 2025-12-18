# PULSE — Component ↔ API Mapping

## Screen 1 — Overview Dashboard

### Signal Summary Card
- Data Source:
  GET /api/analytics/{signal}-profile
- Required Params:
  - facilityId
  - lang
- Used Fields:
  - overall.n
  - overall.low
  - overall.lowRate
- Derived UI State:
  - stable / attention / alert (based on thresholds)

### System Status Banner
- Data Source:
  GET /api/health
- Used Fields:
  - service
  - timestamp (if available)

---

## Screen 2 — Signal Detail View

### Time-Series Chart
- Data Source:
  GET /api/analytics/{signal}-ewma
- Required Params:
  - facilityId
  - lambda
  - L
  - baseline
  - lang
- Used Fields:
  - points[].week
  - points[].lowRate
  - points[].z
  - points[].alert
  - UCL

### Model Output Panel
- Data Source:
  Same as Time-Series Chart
- Used Fields:
  - z
  - UCL
  - alert

### Stratification Controls
- Data Source:
  GET /api/analytics/{signal}-profile
- Used Fields:
  - byAge[]
  - bySex[]

---

## Screen 3 — Spatial Context (Phase 2)
- Data Source:
  GET /api/analytics/{signal}-spatial (future)
- Status:
  Not part of MVP

---

## Screen 4 — Reports & Exports

### Narrative Report Panel
- Data Source:
  GET /api/reports/{signal}?facilityId=...&lang=...
- Used Fields:
  - narrativeText
  - summaryMetrics

### Aggregated Data Table
- Data Source:
  GET /api/analytics/{signal}-profile
- Used Fields:
  - overall
  - byAge
  - bySex

---

## Screen 5 — System Context & Methodology
- Data Source:
  Static content from Codex
- No API calls required

---

## Global Rules
- UI must never compute surveillance metrics.
- All calculations happen in the backend.
- UI derives states only from returned fields.
- Language affects labels only, never numbers.

## Decision Records
(Any change to API usage must be logged here)
