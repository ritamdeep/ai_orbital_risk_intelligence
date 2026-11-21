# ASTRAVIGIL Mission Intelligence — Contract Gaps & Data Discrepancies (`GAPS.md`)

This file logs items from the shared contract task that were missing, ambiguous, or scientifically inconsistent at implementation time, together with the reasonable behaviour implemented so development stayed unblocked.

---

## 1. Missing `/docs/api-contract.md` on `origin/main`
* **Finding:** After running `git fetch origin`, `origin/main` contained only the initial commit (`ccae528`: `.gitignore`, `LICENSE`, `README.md`), and `/docs/api-contract.md` was not present on any branch (`origin/main` or `origin/feature/frontend-dashboard`).
* **Implemented Behaviour:** Built all 6 endpoints specified in the task prompt on port `8001` (`/health`, `GET /api/mission/satellites`, `GET /api/mission/satellites/{noradId}/capabilities`, `GET /api/mission/satellites/{noradId}/criticality`, `GET /api/mission/satellites/{noradId}/alternatives`, `POST /api/mission/satellites/{noradId}/briefing`), using camelCase JSON response fields aligned with Member 1's TypeScript definitions on `origin/feature/frontend-dashboard` (`SatelliteCatalogueItem`, `SatelliteCapabilities`, `CriticalityFactor`, etc.).
* **Standard Error Envelope Assumption:** Implemented a consistent JSON error structure across `404`, `422`, and `500` responses:
  ```json
  {
    "error": {
      "code": "SATELLITE_NOT_FOUND",
      "message": "Satellite with NORAD ID 999999 was not found in the mission database.",
      "status": 404,
      "details": { "noradId": 999999 }
    }
  }
  ```
* **Action Needed:** Once `/docs/api-contract.md` is merged into `main`, diff exact JSON key names and the error envelope against the written contract.

---

## 2. CARTOSAT-3 NORAD ID Discrepancy (`44431` vs. Verified `44804`)
* **Finding:** The task prompt and frontend mock catalog reference `CARTOSAT-3` as NORAD ID **`44431`**. Public orbital catalogs (CelesTrak / N2YO / ISRO PSLV-C47 records) assign ISRO's Cartosat-3 (`2019-081A`) to NORAD ID **`44804`**, whereas NORAD `44431` belonged to `VCC B` (a 1U CubeSat that decayed in October 2021).
* **Implemented Behaviour:**
  * `mission_db.json` exposes Cartosat-3 with `noradId: 44431` (matching the requested contract ID so frontend and integration calls to `.../44431/...` succeed immediately) **and** explicitly records `verifiedNoradId: 44804` and marks the `noradId` field provenance as `dataSource: "mock"` with an explanatory note.
  * Lookups to **both** `44431` and `44804` resolve cleanly to Cartosat-3.
* **Action Needed:** Team should align Frontend, Orbital Risk (CelesTrak/SGP4), and `/docs/api-contract.md` to use `44804` for live TLE propagation of Cartosat-3.

---

## 3. PRATHAM (`41783`) Operational Status Discrepancy
* **Finding:** Frontend mock fixtures list PRATHAM (`41783`) as `"Operational"`. Public tracking references (IIT Bombay / N2YO) confirm PRATHAM launched on September 26, 2016 and ceased active mission beacon transmissions years ago (`Inactive`, remaining in ~670 km LEO).
* **Implemented Behaviour:** Following ASTRAVIGIL's scientific verification rules (never invent operational status), `mission_db.json` records PRATHAM's `status` as `"Inactive"` with public source citations.

---

## 4. Analytical Criticality Factor Scores Marked `dataSource: "mock"`
* **Finding:** Public space agencies publish mission roles, orbit regimes, and sensor characteristics, but do **not** publish standardized `0–100` numeric scores for factors such as `disasterMonitoringSupport`, `uniqueCapability`, or `availabilityOfAlternatives`.
* **Implemented Behaviour:** All verified physical/mission metadata fields carry `dataSource: "real"` with public source references (ISRO, WMO OSCAR, ESA Copernicus, NASA/USGS, JAXA, CSA, IIT Bombay), while every `0–100` criticality factor input is explicitly marked `dataSource: "mock"` with an analytical rationale note.

---

## 5. Frontend Endpoint Path Alignment (`origin/feature/frontend-dashboard`)
* **Finding:** Member 1's current branch (`origin/feature/frontend-dashboard`) points `intelligenceService.ts` at `http://localhost:8000/api/v1/intelligence/...`, whereas the new shared contract specifies port `8001` and `/api/mission/satellites/...`.
* **Implemented Behaviour:** Implemented the exact `/api/mission/satellites/...` routes on port `8001` as instructed, without touching `/frontend`.
