# PULSE — UI/UX Rules (Non-negotiable)

## Global Language Rule (Critical)
- There MUST be exactly ONE language toggle in the header.
- No other language buttons are allowed anywhere else.
- The toggle changes the language for the entire UI (navigation, pages, charts labels, buttons, reports).

## RTL/LTR Behavior
- Arabic = RTL layout
- English = LTR layout
- Switching language must switch direction consistently across the whole app.

## Visual Consistency
- Keep the current color palette and fonts unless a documented Decision Record changes them.
- Use consistent spacing and typography across reports and dashboards.

## Dashboard Professionalism
- Dashboards must include clear loading indicators (skeleton/loading states) for:
  - analytics cards
  - charts
  - report generation / download actions

## Report Behavior
- Narrative report must never be empty:
  - If no data, show a clear “No data available” message in the selected language.
- Report download must show a visible status:
  - idle / generating / ready / failed

## Accessibility & Clarity
- Avoid clutter: one primary action per section.
- Use plain labels and short explanatory hints for non-technical users.

## Decision Records
(Any UI rule change must be logged here)
## Medical-Grade Design Standards (Global UI Principles)

### Design Identity
- The UI must convey a medical, scientific, and premium identity.
- Visual tone should reflect: trust, calmness, precision, and authority.
- Avoid playful, consumer-style, or gamified design elements.

### Simplicity & Cognitive Clarity
- Prioritize clarity over density.
- Each screen should answer one primary question.
- Avoid overwhelming users with excessive metrics on a single view.

### Consistency & Unity
- Use a unified design system across all pages (colors, typography, spacing).
- The same visual language must apply to dashboards, charts, filters, and reports.
- No visual or interaction inconsistency between modules.

### Hierarchy & Readability
- Establish clear visual hierarchy:
  - Primary signals > secondary indicators > contextual details.
- Use whitespace intentionally to separate analytical meaning.
- Charts and numbers must be readable at a glance.

### Clinical Professionalism
- Avoid unnecessary animations or decorative effects.
- Transitions should be subtle, functional, and fast.
- Charts should follow standard epidemiological and medical visualization practices.

### Usability & Global Standards
- Follow established usability principles (ISO 9241, Nielsen heuristics).
- Actions must be predictable and reversible.
- Labels must be explicit and unambiguous (no jargon without explanation).

### Trust Indicators
- Always show:
  - data time range
  - aggregation level
  - baseline reference
- Users must never wonder: “What am I looking at?”

### Scalability of Design
- The design must support future expansion (new signals, new dashboards)
  without redesigning the entire interface.
- New modules must inherit the same visual and interaction rules.

## Decision Records
(Any change to design philosophy must be logged here)
## UI Implementation Strategy (Approved)

### Framework Choice
- Frontend framework: React
- UI Component Library: Material UI (MUI)

### Usage Rules
- MUI components are used as a structural foundation only.
- Default Material styling must be overridden to comply with:
  - Design Tokens (07_DESIGN_TOKENS.md)
  - Medical-Grade Design Standards

### RTL / LTR
- MUI RTL support must be enabled globally.
- Direction switching is controlled only by the global language toggle.

### Forbidden Practices
- No inline styling for core layout components.
- No ad-hoc colors outside Design Tokens.
- No component-level language toggles.

## Decision Records
- 2025-12-15 — Adopted MUI with custom medical-grade theming — Ensures scalability, accessibility, and professional consistency.
