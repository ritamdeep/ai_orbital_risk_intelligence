# ASTRAVIGIL Orbital Risk Backend — API Contract & Implementation Gaps

This document records observations, clarifications, and intentional design choices where `/docs/api-contract.md` or cross-module integration required explicit handling.

---

### Gap 1: Absence of `/docs/api-contract.md` in Root Repository
- **Observation:** The file `/docs/api-contract.md` does not exist in the root repository.
- **Resolution:** Rather than improvising arbitrary schemas, the orbital backend adheres strictly to:
  1. The explicit endpoint definitions, query parameters, and field names prescribed in the user task specification.
  2. The shared TypeScript interface types declared in `frontend/src/types/orbital.ts` and `frontend/src/types/common.ts`.
- **Endpoints Implemented:**
  - `GET /health`
  - `GET /api/orbital/satellites` (with `type` filter)
  - `GET /api/orbital/satellites/{noradId}`
  - `GET /api/orbital/conjunctions` (with `windowHours` and `maxSeparationKm` query params)
  - `GET /api/orbital/conjunctions/{eventId}`

---

### Gap 2: Field Naming Convention (camelCase vs snake_case)
- **Observation:** The contract specification specifies camelCase query and response fields (`noradId`, `windowHours`, `maxSeparationKm`, `eventId`, `tleEpochUtc`, `timestampUtc`, `tleUncertaintyKm`, `screeningNote`, `dataSource`).
- **Resolution:** All Pydantic models are defined with camelCase field names matching the contract directly, while configuring `populate_by_name = True` so both camelCase and snake_case representations can be ingested without validation errors.

---

### Gap 3: Data Source Distinction (`"real"` vs `"mock"`)
- **Requirement:** Anything served from bundled TLE files or simulated values must have `dataSource: "mock"`. Only data fetched live from CelesTrak and propagated using SGP4 gets `dataSource: "real"`.
- **Resolution:**
  - The offline seed file `data/sample_tles.txt` provides the 9 target objects (5 Indian satellites + 4 debris). When initialized from this file, all satellites and resulting conjunctions are stamped with `dataSource: "mock"`.
  - When live CelesTrak TLEs are fetched via the background/on-demand fetcher, the memory store updates and tags the objects with `dataSource: "real"`.
  - Conjunction events derived from any object having `"mock"` data inherit `dataSource: "mock"`. Only pairs where both objects are live CelesTrak records are stamped with `"real"`.

---

### Gap 4: Prohibition of Collision Probability
- **Requirement:** Do NOT output any collision probability, percentage, or risk-of-collision value, and do not name any field or log message that implies one. Describe results as "flagged close approaches".
- **Resolution:**
  - Zero fields named `probability`, `pc`, `collision_probability`, or `risk_percentage` exist in any schema or response payload.
  - Conjunction events report purely physical and astrodynamic metrics: `missDistanceKm`, `relativeVelocityKmS`, `altitudeAtTcaKm`, `tleUncertaintyKm`, and `screeningNote` (e.g. `"Flagged close approach from preliminary SGP4 screening against catalogued debris"`).

---

### Gap 5: Performance & Response Caching
- **Requirement:** The conjunction endpoint should answer in a few seconds, with results cached for ~60 seconds.
- **Resolution:** An in-memory cache keyed by `(windowHours, maxSeparationKm, prioritySatelliteId)` stores computed conjunction events with a 60-second TTL. If a query matches within the TTL, it returns instantaneously (< 5 ms). Cache invalidation occurs automatically when new TLE data is ingested or the TTL expires.
