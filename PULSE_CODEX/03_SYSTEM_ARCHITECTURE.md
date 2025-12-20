# PULSE — System Architecture (High-Level)

## Architectural Principle
PULSE is designed as a non-intrusive analytical overlay.
It does NOT replace existing systems and does NOT interfere with clinical workflows.

## Layered Architecture Overview

### 1) Data Ingestion Layer
- Receives routine laboratory data (batch or scheduled uploads).
- Validates schema, units, and timestamps.
- Accepts data from existing LIS or exported files.

### 2) Preprocessing & Normalization Layer
- Cleans invalid or incomplete records.
- Normalizes biomarkers by age and sex.
- Applies basic temporal smoothing where required.

### 3) Feature Engineering Layer
- Constructs interpretable derived indicators.
- Generates rolling statistics and rates.
- Prepares standardized analytical inputs.

### 4) Detection & Modeling Layer
- Applies statistical models (EWMA, CUSUM, Farrington).
- Runs optional ML-based anomaly detection.
- Produces comparable signal scores.

### 5) Syndromic Abstraction Layer
- Maps detected deviations to physiological signal groups.
- Enables reuse across multiple public-health contexts.
- Keeps detection diagnosis-agnostic.

### 6) Spatial–Temporal Intelligence Layer
- Aggregates signals by time and location.
- Identifies clustering and persistence.
- Enhances contextual interpretation (not causality).

### 7) Visualization & Reporting Layer
- Displays population-level trends and signals.
- Supports dashboards and exportable reports.
- Avoids individual-level interpretation.

## Architectural Constraints
- All outputs are aggregated.
- No clinical decision-making logic.
- All layers are modular and replaceable.

## Decision Records
(Any architectural change must be logged here)
