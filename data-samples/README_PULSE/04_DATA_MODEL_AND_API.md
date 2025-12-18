# PULSE — Data Model & API Contracts (MVP)

## Data Entities (Conceptual)

### Facility
- facilityId (string) — unique code for center/lab

### LabResult (minimum required fields)
- facilityId (string)
- patientKey (string, pseudonymized)
- testCode (string) — e.g., "HB", "WBC"
- value (number)
- unit (string)
- collectedAt (ISO date string)
- age (number) OR ageBand (string)
- sex ("M" | "F")

## Aggregation Rules (MVP)
- Time unit for surveillance: WEEK (ISO week: YYYY-W##)
- Metrics:
  - n = total tests/records in the bucket
  - low = count below threshold (threshold defined by syndrome rule)
  - lowRate = low / n

## API Contracts (MVP)

### Health Check
GET /api/health
Response:
{ ok: true, service: "PULSE API" }

### Anemia Profile (example)
GET /api/analytics/anemia-profile?facilityId=...&lang=en|ar
Response shape:
{
  ok: true,
  facilityId: "…",
  analysis: { signalType: "anemia", method: "PROFILE", params: { lang: "en" } },
  data: {
    profile: {
      overall: { n: number, low: number, lowRate: number },
      byAge: [ { ageBand: string, n: number, low: number, lowRate: number } ],
      bySex: [ { sex: "M"|"F", n: number, low: number, lowRate: number } ]
    }
  }
}

Rules:
- Numbers are language-independent.
- lang affects labels only.

### Anemia EWMA (example)
GET /api/analytics/anemia-ewma?facilityId=...&lambda=0.3&L=3&baseline=2&lang=en|ar
Response shape:
{
  ok: true,
  facilityId: "…",
  ewma: {
    lambda: number,
    L: number,
    baselineWeeksUsed: number,
    baselineMean: number,
    baselineStd: number,
    sigmaZ: number,
    UCL: number,
    points: [
      { week: "YYYY-W##", n: number, low: number, lowRate: number, z: number, alert: boolean }
    ]
  }
}

Rules:
- week is ISO week string.
- alert=true only when z > UCL (or documented rule).
- lang affects labels only.

## Decision Records
(Any contract change must be logged here)
