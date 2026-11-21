# ASTRAVIGIL — Orbital Risk Engine

**Module:** Orbital Risk & Debris Engine (`feature/orbital-risk`)  
**Platform:** ASTRAVIGIL — AI-Powered Orbital Risk Intelligence & Satellite-Service Continuity Platform

---

## Overview

The **Orbital Risk Engine** implements the shared ASTRAVIGIL API contract on port 8000. It provides physical SGP4 propagation and preliminary close-approach screening between operational satellites and catalogued space debris without calculating or displaying fabricated collision probabilities.

### Key Capabilities:
- **Seed Objects Ingestion:** Tracks 5 priority operational Indian satellites (`CARTOSAT-3`, `EOS-04 (RISAT-1A)`, `PRATHAM`, `OCEANSAT-3`, `INSAT-3DR`) and 4 space debris objects (`FENGYUN 1C DEBRIS`, `COSMOS 2251 DEBRIS`, `SL-16 R/B DEBRIS`, `CZ-4C DEBRIS`).
- **CelesTrak GP/TLE Live Sync:** Connects to CelesTrak with 4-hour disk cache TTL and rate-limiting protection.
- **Offline Reliability:** Bundles `data/sample_tles.txt` as a fallback seed source (tagged `dataSource: "mock"`). Data fetched live from CelesTrak is stamped `dataSource: "real"`.
- **SGP4 Propagation:** Vectorized calculations yielding TEME coordinates and WGS84 Geodetic position (latitude, longitude, altitude).
- **Two-Tier Conjunction Screening:** Apogee-perigee altitude pre-filter followed by coarse-to-fine SGP4 step propagation locating the Time of Closest Approach (TCA), minimum miss distance, relative velocity, and positional uncertainty (`tleUncertaintyKm`).
- **60-Second Cache:** The conjunction screening endpoint caches evaluations for ~60 seconds for sub-millisecond responses.
- **Strict Scientific Compliance:** No field named `probability`, `pc`, or `risk_percentage` is produced in any endpoint or log. All events are documented as flagged close approaches with explicit screening notes.

---

## Setup & Running

### 1. Requirements
- Python 3.10+ (tested on Python 3.14)

### 2. Install Dependencies
```bash
cd backend/orbital_risk
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration allows CORS for `http://localhost:5173`.

### 4. Run the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI documentation:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### 5. Run the Test Suite
```bash
pytest app/orbital_engine/tests -v
```

---

## API Endpoints (Port 8000)

| Method | Endpoint | Query / Path Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Service health, TLE source (`celestrak` vs `mock`), and object count |
| `GET` | `/api/orbital/satellites` | `type` (optional: `payload`, `debris`, `rocket_body`) | List tracked satellites with SGP4 positions |
| `GET` | `/api/orbital/satellites/{noradId}` | `noradId` (integer) | Detailed state for single satellite (404 if not found, 422 if invalid) |
| `GET` | `/api/orbital/conjunctions` | `windowHours` (default 48.0), `maxSeparationKm` (default 100.0) | List flagged close approaches within threshold |
| `GET` | `/api/orbital/conjunctions/{eventId}` | `eventId` (format: `CONJ-YYYY-NNNN`) | Detailed kinematics for a specific conjunction event |

---

## Standard Error Response Format

HTTP 404 (Not Found):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Satellite with NORAD ID 999999 not found in catalog",
    "details": null
  },
  "detail": "Satellite with NORAD ID 999999 not found in catalog"
}
```

HTTP 422 (Unprocessable Content):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameter",
    "details": [...]
  },
  "detail": [...]
}
```
