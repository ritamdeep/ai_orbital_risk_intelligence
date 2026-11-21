# ASTRAVIGIL — Orbital Risk & Debris Engine

**Module:** Member 2 (`feature/orbital-risk`)  
**Platform:** ASTRAVIGIL — AI-Powered Orbital Risk Intelligence & Satellite-Service Continuity Platform

---

## Overview

The **Orbital Risk & Debris Engine** provides deterministic orbital mechanics and conjunction screening capabilities for ASTRAVIGIL:
- **CelesTrak Ingestion & Caching:** Ingests General Perturbations (GP) / Orbit Mean-elements Messages (OMM) with transparent offline fallback.
- **SGP4 / SDP4 Orbital Propagation:** Standard NORAD propagation producing TEME ECI and WGS84 Geodetic positions (lat, lon, alt) and speeds.
- **Forward Ephemeris Generation:** Trajectory points for Member 1's 3D Globe visualization.
- **Two-Tier Conjunction Screening:**
  1. *Geometric Filter:* Fast apogee-perigee altitude shell evaluation.
  2. *SGP4 Time-Stepping:* Coarse scan + fine-grained TCA (Time of Closest Approach), miss distance, and relative velocity vector refinement.
- **Scientific Labeling:** Adheres to all space safety rules; outputs preliminary screening events without fabricating collision probabilities ($P_c$).

---

## Setup & Running

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)

### 2. Install Dependencies
```bash
cd backend/orbital_risk
pip install -r requirements.txt
```

### 3. Run the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation will be available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### 4. Run Tests
```bash
pytest app/orbital_engine/tests -v
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | System banner and active module metadata |
| `GET` | `/api/health` | High-level service health check |
| `GET` | `/api/orbital/health` | Engine status, catalog cache counts, active branch |
| `GET` | `/api/orbital/objects` | Query tracked operational satellites and debris (`type`, `search`, `limit`) |
| `GET` | `/api/orbital/objects/{norad_id}` | Detailed orbital elements for a specific NORAD object |
| `GET` | `/api/orbital/objects/{norad_id}/ephemeris` | Forward trajectory coordinates (Lat, Lon, Alt, ECI) for 3D Globe |
| `GET` | `/api/orbital/debris` | Dedicated catalog of catalogued space debris and rocket bodies |
| `POST`| `/api/orbital/screenings` | Trigger on-demand conjunction screening for a target satellite |
| `GET` | `/api/orbital/events` | List preliminary close-approach screening events |
| `GET` | `/api/orbital/events/{event_id}` | Detailed encounter kinematics and miss-distance breakdown |

---

## Scientific Disclaimers

All close-approach screening outputs are strictly labeled:
> **PRELIMINARY_SCREENING_ONLY:** Deterministic SGP4 propagation from mean orbital elements. This is NOT a validated Conjunction Assessment and does NOT calculate collision probability ($P_c$). No covariance error ellipsoids are modeled in TLE data.
