# ASTRAVIGIL — Integration Gaps & API Contract Mappings (`INTEGRATION_GAPS.md`)

This document records all differences, ambiguities, schema alignments, and scientific requirements identified when integrating the ASTRAVIGIL Frontend (`feature/frontend-dashboard`) with the live backend services: **Orbital Risk Engine** (Member 2, port 8000) and **Mission Intelligence Service** (Member 3, port 8001).

---

## 1. Executive Summary of Service Endpoints

| Microservice | Port | Base Path | Status |
| :--- | :--- | :--- | :--- |
| **Orbital Risk Engine** (Member 2) | `8000` | `http://localhost:8000` | Operational (`/health`, `/api/orbital/satellites`, `/api/orbital/conjunctions`) |
| **Mission Intelligence** (Member 3) | `8001` | `http://localhost:8001` | Operational (`/health`, `/api/mission/satellites/...`) |
| **ASTRAVIGIL Frontend** (Member 1) | `3000` / `5173` | `http://localhost:3000` | Operational with Live, Partial, and Mock fallback telemetry |

---

## 2. Identified Integration Gaps & Action Items

### Gap 1: NORAD ID Discrepancy for CARTOSAT-3 (`44431` vs `44804`)
* **What the UI needs:** The user specification and earlier mock data referenced `CARTOSAT-3` as NORAD ID `44431`.
* **What Member 2 (Orbital Risk) returns:** `backend/orbital_risk` uses verified NORAD ID `44804` (derived from CelesTrak / Space-Track PSLV-C47 catalog). Queries to `GET /api/orbital/satellites/44431` return `404 NOT_FOUND`.
* **What Member 3 (Mission Intelligence) returns:** Exposes `noradId: 44431` and `verifiedNoradId: 44804`, accepting both in URL path lookups.
* **Frontend Adaptation:** Frontend adapters maintain a bidirectional alias mapping between `44431` and `44804`. When querying the Orbital Risk backend for CARTOSAT-3, `44804` is requested; when joining with Mission Intelligence, both IDs resolve to the same satellite entity.
* **Action for Member 2:** In `app/orbital_engine/router.py`, add support for alias lookups (e.g., mapping `44431` to `44804`) so direct contract calls to `44431` succeed on port 8000.

---

### Gap 2: Contract File `/docs/api-contract.md` Not Present on Main
* **Observation:** The contract specification file `/docs/api-contract.md` referenced in early documentation was not checked in to root `main`.
* **What Backends Did:** Both Member 2 and Member 3 implemented strict contract-compliant endpoints using camelCase schemas matching the project specifications.
* **Resolution:** Frontend adapts cleanly to these real responses, and records the canonical schemas here.

---

### Gap 3: Casing & Model Structure (camelCase Backend vs legacy snake_case Mock Data)
* **What Backends Return:** Strict camelCase Pydantic v2 models:
  * Orbital: `noradId`, `perigeeKm`, `apogeeKm`, `inclinationDeg`, `periodMin`, `tleEpochUtc`, `missDistanceKm`, `relativeVelocityKmS`, `altitudeAtTcaKm`, `tleUncertaintyKm`, `screeningNote`, `isPreliminaryScreening`, `primaryObject`, `secondaryObject`.
  * Mission: `noradId`, `verifiedNoradId`, `sensorFamily`, `allWeatherCapable`, `spatialResolutionMeters`, `revisitDays`, `capabilityMatch`, `redundancyGaps`, `criticality.score`, `criticality.tier`.
* **What Legacy Frontend Expected:** Several early mock fixtures used Python/C-style snake_case (`norad_id`, `miss_distance_km`, `relative_velocity_kms`, `primary_object`).
* **Frontend Adaptation:** The unified TypeScript types in `frontend/src/types/` define canonical camelCase models with normalized adapters that accept both real backend camelCase responses and legacy mock fallback records without runtime errors.

---

### Gap 4: Scientific Rule #5 Compliance (Prohibition of Collision Probability)
* **Rule:** High mission criticality increases operator triage priority but does NOT alter orbital mechanics. Fabricated collision probabilities (`pc`, `probability`, `% risk`) are strictly prohibited in the UI and backends.
* **Backend Verification:**
  * Orbital Risk Engine reports purely physical and astrodynamic metrics: `missDistanceKm`, `relativeVelocityKmS`, `altitudeAtTcaKm`, `tleUncertaintyKm`, and descriptive `screeningNote`.
  * Mission Intelligence computes deterministic criticality scores ($0-100$) purely from mission dependencies and capability factors, completely decoupled from orbital geometry.
* **Frontend Enforcement:** The frontend strictly ignores any probability or collision likelihood fields if present, keeping Orbital Hazard (physical miss distance) and Mission Criticality (societal impact) on strictly decoupled orthogonal axes in the Risk Analysis Matrix and Alerts Centre.

---

### Gap 5: PRATHAM Operational Status (`"Operational"` vs `"Inactive"`)
* **What Legacy Frontend Mock Data Showed:** PRATHAM (`41783`) was listed with status `"Operational"`.
* **What Member 3 (Mission Intelligence) Returns:** `status: "Inactive"`, because public academic tracking confirms PRATHAM's mission beacon transmissions ended after its nominal mission life.
* **Frontend Adaptation:** Display the real verified status (`Inactive`) returned by Mission Intelligence when live data is loaded, rather than forcing synthetic values.

---

### Gap 6: Default Conjunction Screening Thresholds
* **What Orbital Backend Implements:** `GET /api/orbital/conjunctions` has parameters `windowHours` (default 48.0) and `maxSeparationKm` (default 100.0).
* **Observation:** In close-approach screening with 5 operational seeds and 4 debris seeds, close approaches under 15 km may not occur every 48 hours. At `maxSeparationKm=100.0` or `windowHours=168.0`, multiple close approaches are flagged (e.g. `PRATHAM` with `COSMOS 2251 DEBRIS` at 85.77 km; `EOS-04` with `SL-16 R/B DEBRIS` at 79.62 km).
* **Frontend Adaptation:** Frontend passes query parameters `windowHours=168&maxSeparationKm=200` to ensure operators always have active screening events to investigate in the Risk Analysis matrix and Alerts Centre.

---

### Gap 7: Default CORS Origins on Port 8001 (Member 3)
* **What Mission Backend Implements:** In `backend/mission_intelligence/config.py`, `get_cors_origins()` defaults strictly to `["http://localhost:5173"]` when `CORS_ORIGINS` is unset.
* **Problem:** The Vite frontend runs on port `3000` (e.g. `http://localhost:3000` and `http://127.0.0.1:3000`). Without explicit environment variable passing, browsers block cross-origin requests to `http://localhost:8001` during preflight OPTIONS requests.
* **Frontend Adaptation:** Frontend implements automatic fallback to deterministic offline models when preflight fails, avoiding any application crash.
* **Action for Member 3:** Update `get_cors_origins()` in `backend/mission_intelligence/config.py` default fallback to include `http://localhost:3000,http://127.0.0.1:3000` alongside port `5173`, mirroring Member 2's `backend/orbital_risk/app/core/config.py`.

