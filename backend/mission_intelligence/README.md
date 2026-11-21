# ASTRAVIGIL — AI & Mission Intelligence Module (Member 3)

Isolated backend module powering **Pillar B (Mission Criticality & Earth Impact Intelligence)** and **Pillar C (Satellite Service Continuity & Alternative Identification)** for **ASTRAVIGIL**.

## Module Structure

```text
backend/mission_intelligence/
├── mission_db.json           # Curated public catalog of 24 real Indian & global satellites (by NORAD ID)
├── schemas.py                # Shared Pydantic v2 API contracts & provenance models
├── database.py               # Mission catalog loader & filter utilities
├── scoring_engine.py         # Orbital Risk × Mission Criticality × Earth Impact explainable triage engine
├── continuity_engine.py      # Earth-service disruption, redundancy gaps & overlapping alternative finder
├── ai_explainer.py           # Grounded LLM advisory generator (Gemini / OpenAI) + deterministic fallback
├── mission_routes.py         # FastAPI APIRouter (/api/missions, /api/analyze-impact, /api/alternatives)
├── app.py                    # Standalone runnable FastAPI server for independent dev/testing
├── sample_payloads/          # Simulated conjunction scenarios (flood, cyclone, startup SmallSat)
└── tests/                    # Automated pytest verification suite
```

## Quick Start (Standalone Mode)

From the repository root:

```bash
python -m venv backend/mission_intelligence/.venv
# Windows PowerShell:
.\backend\mission_intelligence\.venv\Scripts\Activate.ps1
pip install -r backend/mission_intelligence/requirements.txt

# Run API locally on port 8001 (Swagger UI at http://127.0.0.1:8001/docs)
uvicorn backend.mission_intelligence.app:app --reload --port 8001

# Run automated tests
pytest backend/mission_intelligence/tests -v
```

## Seamless Integration for Member 1 & Member 2

### For Member 2 (Unified FastAPI Backend)
Mount this module with zero merge conflicts:

```python
from backend.mission_intelligence import mission_router

app.include_router(mission_router)
```

### For Member 1 (Frontend Dashboard)
Available REST endpoints:
* `GET /api/health` — Module status, loaded satellite count, and AI explainer mode (`llm_gemini`, `llm_openai_compatible`, or `deterministic_fallback`).
* `GET /api/missions` — List/filter catalogued satellites (`mission_type`, `country`, `service_id`, `sensor_modality`, `region`).
* `GET /api/missions/{norad_id}` — Detailed mission profile, sensor capabilities, baseline Mission Criticality, and baseline Earth Impact.
* `GET /api/alternatives/{norad_id}` — Overlapping backup satellites, capability overlap scores, service disruptions, and explicit redundancy gaps.
* `POST /api/analyze-impact` — Accepts Member 2's conjunction alert JSON (see `sample_payloads/flood_monitoring_eos04_alert.json`) and returns:
  * `priority_assessment` (`explainable_priority_score`, numeric formula trace, and **separate** `orbital_screening`, `mission_criticality`, and `earth_impact` dimensions)
  * `disrupted_services` & `redundancy_gaps`
  * `alternative_satellites` (ranked with explicit limitations & replacement caveats)
  * `ai_advisory` (plain-language operator brief + action checklist + mandatory scientific caveats)

## Optional LLM Configuration

No API key is required; the module automatically uses its scientifically audited deterministic advisory engine by default. To enable grounded LLM explanations:

```bash
# Option 1: Gemini API
export ASTRAVIGIL_LLM_PROVIDER=gemini
export GEMINI_API_KEY=your_key_here

# Option 2: OpenAI-compatible API
export ASTRAVIGIL_LLM_PROVIDER=openai
export OPENAI_API_KEY=your_key_here
```

## How Criticality, Earth Impact & Priority Are Calculated

ASTRAVIGIL keeps **physical orbital screening**, **mission criticality**, and **Earth-level impact** as three separate dimensions (mission importance never alters collision probability):

1. **Mission Criticality Score (`0.00` – `1.00`, deterministic & explainable):**
   $$\text{Mission Criticality} = 0.35 \times \text{Disaster Response Reliance} + 0.25 \times \text{Service Dependency Breadth} + 0.25 \times \text{Domestic Redundancy Scarcity} + 0.15 \times \text{Sensor Uniqueness}$$
   * **Disaster Response Reliance (35%):** Degree to which emergency workflows (flood, cyclone, search & rescue) depend on the satellite.
   * **Service Dependency Breadth (25%):** Number and breadth of documented terrestrial services and sectors supported.
   * **Domestic Redundancy Scarcity (25%):** Availability of same-country or same-constellation backup satellites.
   * **Sensor Uniqueness (15%):** Specialized sensing capability (e.g., all-weather C-band SAR, NavIC PNT, geostationary atmospheric sounder).
   * Uncatalogued satellites receive a neutral `0.50` baseline instead of fabricated parameters.

2. **Earth Impact Score (`0.00` – `1.00`) with Dynamic Context Multipliers:**
   * Base score is derived from each satellite's highest active service dependency tier (`CRITICAL = 0.85`, `HIGH = 0.68`, `MODERATE = 0.45`, `LOW = 0.20`) plus a small multi-service breadth bonus (capped at `0.92`).
   * Active disaster alerts (`flood_alert`, `cyclone_alert`, `earthquake_alert`, `landslide_alert`, `wildfire_alert`, `drought_alert`, `telecom_outage`, `maritime_emergency`) dynamically multiply Earth Impact (`+0.08` to `+0.40` by severity, plus `+0.10` for all-weather SAR during flood/cyclone events, attenuated by 50% if outside primary coverage region; cumulative multiplier capped at `1.60x`, effective score capped at `1.00`).

3. **Explainable Priority Score (`0.00` – `100.00`):**
   $$\text{Explainable Priority Score} = \text{Orbital Screening Risk} \times \text{Mission Criticality} \times \text{Effective Earth Impact} \times 100$$
   * Triage bands: `CRITICAL_PRIORITY` (`>= 60`), `HIGH_PRIORITY` (`>= 35`), `ELEVATED_MONITORING` (`>= 15`), `ROUTINE_WATCH` (`< 15`).
   * Physical collision probability (`collision_probability`) is always `null` for public TLE screening.

## Scientific Guardrails Built Into This Module
1. `collision_probability` is always `null` for public TLE screening (never fabricated without CDM covariance).
2. `Orbital Risk`, `Mission Criticality`, and `Earth Impact` are always returned as separate dimensions; mission importance never alters collision probability.
3. Alternative satellites are explicitly labeled as partial matches with concrete sensor/revisit/access limitations—never automatic 1:1 replacements.
4. All responses carry explicit `provenance` metadata distinguishing verified public mission profiles from simulated conjunction scenarios.
