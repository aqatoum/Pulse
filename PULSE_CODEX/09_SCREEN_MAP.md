# PULSE — Screen Map (User-Facing Structure)

## Primary User Flow
User enters the system to answer one main question:
"Is there any unusual population-level signal I should be aware of?"

---

## Screen 1 — Overview Dashboard (Home)
### Purpose
- Provide immediate situational awareness.

### Contains
- Global time range selector
- Facility / region selector
- Key signal summary cards (e.g., Anemia, Inflammatory Stress)
- Status indicators (stable / attention / alert)

### User Outcome
User understands within 10 seconds:
- Whether the system is calm or showing deviations.

---

## Screen 2 — Signal Detail View
### Purpose
- Deep dive into one selected signal.

### Contains
- Time-series chart with baseline and thresholds
- EWMA / CUSUM / Farrington outputs
- Explanation panel (plain language)
- Stratification options (age, sex)

### User Outcome
User understands:
- When the deviation started
- How strong and persistent it is
- Which population segments are affected

---

## Screen 3 — Spatial Context (Optional / Phase 2)
### Purpose
- Geographic interpretation of signals.

### Contains
- Map or region-based aggregation
- Temporal filtering
- Signal intensity visualization

### User Outcome
User understands:
- Where signals are concentrated (not why)

---

## Screen 4 — Reports & Exports
### Purpose
- Formal communication and documentation.

### Contains
- Narrative summary (auto-generated)
- Data tables (aggregated only)
- Export actions (PDF, image)

### User Outcome
User can:
- Share findings with decision-makers confidently.

---

## Screen 5 — System Context & Methodology
### Purpose
- Transparency and trust.

### Contains
- Explanation of methods (EWMA, CUSUM, Farrington)
- Data scope and limitations
- Ethical and governance notes

### User Outcome
User trusts the system and understands its boundaries.

---

## Navigation Rules
- Navigation must be linear and minimal.
- No more than 5 primary screens.
- Always allow return to Overview Dashboard.

---

## Decision Records
(Any change to screen structure must be logged here)
