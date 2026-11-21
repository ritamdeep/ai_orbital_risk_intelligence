# ASTRAVIGIL — Mission Intelligence Backend (Member 3)

FastAPI microservice implementing ASTRAVIGIL's shared Mission Intelligence API contract on **port 8001**: verified satellite mission catalog, deterministic explainable criticality scoring (`rule_based_v1`), alternative satellite comparison with redundancy gaps, and scientifically guarded AI briefings.

> See [GAPS.md](./GAPS.md) for contract alignment notes, including the CARTOSAT-3 NORAD ID alias (`44431` vs. verified `44804`) and PRATHAM (`41783`) inactive status.

---

## Quick Start (Port 8001)

From the repository root:

```bash
python -m venv backend/mission_intelligence/.venv
# Windows PowerShell:
.\backend\mission_intelligence\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source backend/mission_intelligence/.venv/bin/activate

pip install -r backend/mission_intelligence/requirements.txt

# Start the server on port 8001 (Swagger UI: http://127.0.0.1:8001/docs)
uvicorn backend.mission_intelligence.app:app --reload --port 8001
```

### Run Automated Tests

```bash
pytest backend/mission_intelligence/tests -v -o cache_dir=backend/mission_intelligence/.pytest_cache
```

### Environment Variables (`.env.example`)
* `CORS_ORIGINS` — Comma-separated allowed origins (default: `http://localhost:5173`).
* `LLM_API_KEY` — Optional LLM key (never committed). If omitted, times out (>15 s), fails, or fails the scientific post-check, `POST .../briefing` returns deterministic `generatedBy: "rule_based"` text.
* `LLM_PROVIDER` — `gemini` (default) or `openai`.
* `LLM_MODEL` — Optional model override.
* `LLM_TIMEOUT_SECONDS` — HTTP timeout in seconds (default: `15`).

---

## API Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/health` | Service status, loaded satellite count, `methodology`, `llmConfigured`. |
| `GET` | `/api/mission/satellites` | List satellites (optional filters: `category`, `operator`, `status`, `search`). |
| `GET` | `/api/mission/satellites/{noradId}/capabilities` | Sensor capabilities, supported Earth services, and per-field provenance (`real` vs `mock`). |
| `GET` | `/api/mission/satellites/{noradId}/criticality` | Deterministic `rule_based_v1` criticality score, tier, and weighted factor breakdown. |
| `GET` | `/api/mission/satellites/{noradId}/alternatives` | Candidate alternative satellites, 5-field comparison, `capabilityMatch` (0–100), `limitations`, `redundancyGaps`, and `caveat`. |
| `POST` | `/api/mission/satellites/{noradId}/briefing` | Guarded natural-language briefing (`generatedBy: "llm"` or `"rule_based"`) separating physical separation from mission importance. |

Standard error envelope (`404`, `422`, `500`):
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

---

## Explainable Criticality Scoring (`rule_based_v1`)

Mission criticality is **100% deterministic and completely independent of orbital telemetry** (miss distance, TCA, relative velocity). Mission importance never changes physical collision likelihood.

### Formula & Weights (Single Source of Truth in `config.py`)

$$\text{Score} = \operatorname{round}\!\left(\sum_{i=1}^{6} w_i \cdot v_i^{\text{eff}}\right)$$

| Factor | Weight ($w_i$) | Direction | Effective Value ($v_i^{\text{eff}}$) |
| :--- | :---: | :--- | :--- |
| `disasterMonitoringSupport` — Disaster-monitoring support | **0.25** | Higher → more critical | $v$ |
| `uniqueCapability` — Unique capability | **0.20** | Higher → more critical | $v$ |
| `serviceDependency` — Service dependency | **0.20** | Higher → more critical | $v$ |
| `availabilityOfAlternatives` — Availability of alternatives | **0.15** | **Inverted:** fewer alternatives → higher criticality | $100 - v$ |
| `nationalInfrastructureDefence` — National infrastructure & defence value | **0.10** | Higher → more critical | $v$ |
| `commercialScientificValue` — Commercial & scientific value | **0.10** | Higher → more critical | $v$ |

### Tier Thresholds (`CRITICALITY_TIER_CONFIG`)
* **`85 – 100`** → `TIER_1_CRITICAL`
* **`70 – 84`** → `TIER_2_HIGH`
* **`40 – 69`** → `TIER_3_MODERATE`
* **`0 – 39` (`< 40`)** → `TIER_4_LOW`

### Worked Example: "Why 92?" (`CARTOSAT-3`, NORAD `44431` / verified `44804`)
| Factor | Raw $v$ | Effective $v^{\text{eff}}$ | Weight | Contribution |
| :--- | :---: | :---: | :---: | :---: |
| Disaster-monitoring support | 94 | 94 | 0.25 | 23.50 |
| Unique capability | 95 | 95 | 0.20 | 19.00 |
| Service dependency | 90 | 90 | 0.20 | 18.00 |
| Availability of alternatives *(inverted)* | 15 | **85** (`100 - 15`) | 0.15 | 12.75 |
| National infrastructure & defence value | 95 | 95 | 0.10 | 9.50 |
| Commercial & scientific value | 92 | 92 | 0.10 | 9.20 |
| **Total** | | | **1.00** | **`91.95` → `92` (`TIER_1_CRITICAL`)** |

---

## Alternative Satellite Matching (`capabilityMatch`, 0–100)
Deterministic per-field comparison across five dimensions:
* `sensorType` (35 pts) + `spatialResolution` (20 pts) + `revisitTime` (15 pts) + `coverage` (15 pts) + `dataAccess` (15 pts), capped at **95** so no alternative implies a 1:1 replacement.
* Every response includes concrete per-field limitations, plain-language `redundancyGaps`, and the mandatory caveat text.

## Data Verification Policy
* Verified public mission attributes (ISRO, WMO OSCAR, ESA Copernicus, NASA/USGS, JAXA, CSA, EUMETSAT, JMA, IIT Bombay) are marked `dataSource: "real"` with reference URLs in `sources` and `fieldProvenance`.
* Analytical 0–100 criticality factor inputs, generic unverified revisit ranges, and CARTOSAT-3's contract-alias NORAD `44431` are explicitly marked `dataSource: "mock"`.
