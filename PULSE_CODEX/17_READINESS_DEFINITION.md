# PULSE — Readiness Definition (Market / Competition / Master’s)

## Goal
Convert PULSE from a working prototype into an evaluated, presentable, and deployable MVP
suitable for market pilots, competitions, and Master’s scholarship applications.

---

## A) MVP Readiness (Must-Have)
1) One global language toggle (AR/EN) works across the entire UI with RTL/LTR.
2) Dashboard is professional:
   - Loading / Empty / Error states everywhere
   - Data freshness indicator (last updated + time range + aggregation level)
3) Reports are never empty:
   - Narrative report always returns meaningful text or an explicit “insufficient data” message
4) API Contracts are stable:
   - Endpoints return consistent JSON shapes as documented in Codex
5) Ethical boundary enforced:
   - Population-level only
   - No diagnosis / no clinical recommendations
6) Demo dataset available:
   - Non-identifiable realistic data enabling consistent demonstrations

---

## B) Evidence Readiness (Competition / Master’s)
1) Clear evaluation section:
   - What metrics prove value (lead-time, precision, false alarms, stability)
2) Method explainability:
   - EWMA/CUSUM/Farrington explanation visible and consistent
3) Governance & trust:
   - Audit indicators (parameters, timestamp, methodology)
4) Reproducibility:
   - A documented way to run the system (dev + production-like)

---

## C) Deployment Readiness (Pilot / Market)
1) Setup documentation:
   - Installation, environment variables, run commands
2) Security basics:
   - Auth, roles, access control for dashboards/reports
3) Data ingestion workflow:
   - Clear supported format + validation + error feedback
4) Minimal monitoring:
   - Basic logs + health endpoint usage

---

## Decision Records
(Any readiness criteria change must be logged)
