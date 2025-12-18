# PULSE Methodology
Population Laboratory Surveillance Engine

## 1. Purpose of the System
PULSE is a population-level laboratory surveillance system designed to support
early detection of abnormal health patterns using aggregated laboratory data.
The system is intended for public health monitoring, planning, and decision support.
It does NOT provide individual diagnosis or clinical decision-making.

---

## 2. Data Source and Scope
- Input data consist of anonymized laboratory test results.
- Analysis is performed at the facility or population level.
- Individual patient identities are not evaluated or inferred.
- All outputs represent statistical signals, not medical diagnoses.

---

## 3. Signal Definition (Example: Anemia)
For anemia surveillance, hemoglobin (Hb) values are evaluated against
age- and sex-adjusted thresholds derived from WHO-aligned references.

Each test result is classified as:
- Normal
- Below threshold (low Hb)

Only aggregated counts and rates are used in downstream analysis.

---

## 4. Analytical Methods

### 4.1 EWMA (Exponentially Weighted Moving Average)
EWMA is used to detect gradual or sustained shifts in the rate of abnormal results.
Recent observations are weighted more heavily than older data, allowing early
detection of subtle trends.

Key characteristics:
- Sensitive to small but persistent changes
- Suitable for continuous surveillance
- Generates upper control limits (UCL) for alerting

---

### 4.2 CUSUM (Cumulative Sum Control Chart)
CUSUM accumulates deviations from an expected baseline to detect sustained
departures from normal behavior.

Key characteristics:
- Effective for detecting small shifts
- Resistant to random noise
- Provides clear alert thresholds

---

### 4.3 Farrington Algorithm
The Farrington method is a widely used outbreak detection technique in
public health surveillance.

Key characteristics:
- Uses historical baselines
- Accounts for overdispersion
- Suitable for count-based surveillance data
- Commonly used by national public health agencies

---

## 5. Ensemble Consensus Logic
No single algorithm is treated as authoritative.

PULSE combines multiple analytical methods using a consensus mechanism:
- Each method independently evaluates the signal
- Results are aggregated into a unified decision:
  - INFO
  - WATCH
  - ALERT

This ensemble approach improves robustness and reduces false alarms.

---

## 6. Stratification and Profiling
To enhance interpretability, PULSE performs stratified analysis by:
- Age groups
- Sex

Stratification is used to identify sub-populations that may contribute
disproportionately to an observed signal. These findings are presented
as contextual insights, not causal conclusions.

---

## 7. Narrative Reporting
PULSE generates narrative reports designed for:
- Public health committees
- Administrators
- Policy stakeholders

Reports summarize:
- Data volume and coverage
- Methods used
- Consensus decision
- Key stratification findings
- Recommended public health actions

All narrative outputs are explanatory and advisory in nature.

---

## 8. Data Quality Indicators
Each analysis includes basic data quality indicators such as:
- Total sample size
- Recent sample volume
- Time-series coverage
- Small-sample warnings

These indicators support responsible interpretation of results.

---

## 9. Limitations and Disclaimer
- PULSE does not diagnose individuals.
- Results depend on data completeness and reporting practices.
- Signals indicate statistical anomalies, not confirmed health events.
- Human review and contextual interpretation are required before action.

---

## 10. Intended Use
PULSE is intended to support:
- Early public health awareness
- Resource planning
- Preventive interventions
- Epidemiological exploration

It is not a substitute for clinical judgment or formal epidemiological investigation.
