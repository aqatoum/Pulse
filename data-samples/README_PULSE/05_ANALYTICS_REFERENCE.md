# PULSE — Analytics Reference (EWMA / CUSUM / Farrington)

## Shared Concepts (Applies to all)
- We monitor a population-level metric per time bucket (weekly): e.g., lowRate = low / n.
- Baseline is computed from a defined number of historical weeks.
- Outputs are decision-support signals, not diagnoses.

---

## 1) EWMA (Exponentially Weighted Moving Average)

### Purpose
Detect gradual or sustained shifts in a monitored rate (e.g., anemia lowRate) with smoothing.

### Core Formula
Z_t = λ * X_t + (1 − λ) * Z_(t−1)

Where:
- X_t: observed metric at week t (e.g., lowRate)
- Z_t: EWMA smoothed value
- λ (lambda): smoothing factor (0 < λ ≤ 1)

### Intuition (Non-technical)
EWMA is like a “smart average” that listens more to recent weeks but never forgets the past.

### Control Limit (concept)
Alert if Z_t exceeds an upper control limit (UCL) based on baseline mean and variability.

### Practical Parameters
- λ (lambda):
  - smaller → smoother, slower, fewer false alarms
  - larger → faster, more sensitive, potentially noisier
- L:
  - wider limits (higher L) → fewer alerts
  - tighter limits (lower L) → more alerts
- baselineWeeks:
  - number of historical weeks used to estimate baseline mean/std

### Implementation Notes (for code)
- X_t must be defined even when n is small; handle n=0 safely.
- Baseline mean/std must be computed on comparable weeks.
- Store weekly points: week, n, low, lowRate, z, alert.

---

## 2) CUSUM (Cumulative Sum)

### Purpose
Detect small persistent shifts by accumulating deviations over time.

### Intuition (Non-technical)
CUSUM is a “deviation bank account”: small weekly increases add up until they become undeniable.

### Implementation Notes (for code)
- Requires defining a target/baseline and a decision threshold.
- Use when you want sensitivity to small but consistent changes.

---

## 3) Farrington Algorithm

### Purpose
Detect outbreaks/aberrations using historical counts with seasonality-aware thresholds.

### Intuition (Non-technical)
Farrington asks: “Is this week unusually high compared to similar weeks in previous years?”

### Implementation Notes (for code)
- Best when you have longer historical history (often multiple years).
- Works naturally on counts; adapt carefully when monitoring rates.

---

## How to explain to a committee (two lines)
PULSE uses validated surveillance methods (EWMA/CUSUM/Farrington) to detect unusual population-level shifts in routine lab signals earlier than diagnosis-based reporting, while keeping outputs aggregated, explainable, and ethically governed.

## Decision Records
(Any change in formulas/assumptions must be logged here)
