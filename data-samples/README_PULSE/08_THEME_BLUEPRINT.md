# PULSE — Theme Blueprint (Medical UI)

## Theme Philosophy
The PULSE theme prioritizes clarity, trust, and analytical calm.
The interface must feel like a clinical control room, not a consumer app.

---

## Color Application Rules

### Primary Color Usage
- Used for:
  - Main navigation
  - Page titles
  - Primary action buttons
  - Key active states
- Must never dominate charts or overwhelm data.

### Secondary Color Usage
- Used for:
  - Supporting indicators
  - Secondary actions
  - Positive or stable states
- Must remain visually quieter than primary color.

### Background Strategy
- Global background: light neutral (off-white / very light gray)
- Cards and panels: slightly elevated contrast
- Never use pure white for large surfaces.

---

## Typography Application

### Font Selection Rule
- One font family only (Arabic + English compatible).
- No font mixing across components.

### Text Hierarchy
- H1: Page-level analytical context
- H2: Section-level grouping
- Body: Explanations and metadata
- Numbers: Emphasized but not oversized

Line spacing must favor readability over density.

---

## Component Behavior Rules

### Cards
- Represent analytical units.
- Must contain:
  - Title
  - Context (time range, facility, aggregation)
  - Primary metric
- No decorative elements.

### Charts
- Always include:
  - Axis labels
  - Baseline reference
  - Time range
- Color usage inside charts is strictly limited.

---

## Alerts & Signals

### Visual Severity Levels
- Informational: neutral tone
- Attention needed: amber
- Significant deviation: muted red

Severity must be communicated calmly, never alarmist.

---

## Language & Direction

### Language Switching
- Theme must support instant RTL/LTR switch.
- Spacing, alignment, and icons must flip correctly.

### Typography Direction
- Arabic text must not appear compressed.
- English text must not appear oversized.

---

## Forbidden Visual Practices
- Bright or saturated colors
- Excessive gradients
- Shadows used for decoration
- Dense data tables without spacing

---

## Theme Governance Rule
Any change to the theme must:
- Reference this blueprint
- Be logged in Decision Records
- Preserve medical-grade professionalism
