# ASTRAVIGIL — Execution & Operations Guide (`RUNNING.md`)

This guide provides the exact commands, virtual environments, ports, and configuration needed to run the entire ASTRAVIGIL platform locally across its three core services:
1. **Orbital Risk Engine** (Port `8000`)
2. **Mission Intelligence Service** (Port `8001`)
3. **ASTRAVIGIL Frontend Dashboard** (Port `3000` / `5173`)

---

## 1. Architecture & Port Mapping

| Service | Technology | Port | Base URL | Swagger / Docs |
| :--- | :--- | :--- | :--- | :--- |
| **Orbital Risk Engine** | FastAPI, SGP4, NumPy | `8000` | `http://localhost:8000` | `http://localhost:8000/docs` |
| **Mission Intelligence** | FastAPI, Pydantic v2 | `8001` | `http://localhost:8001` | `http://localhost:8001/docs` |
| **Frontend Dashboard** | React 18, Vite, Three.js, Tailwind | `3000` | `http://localhost:3000` | N/A |

---

## 2. Prerequisites
* **Python**: 3.10+ (tested on Python 3.13 / 3.14)
* **Node.js**: 18+ and `npm`

---

## 3. Starting Service 1: Orbital Risk Engine (Port 8000)

The Orbital Risk Engine propagates satellite positions via SGP4 and screens preliminary close approaches without fabricated collision probabilities.

### Setup & Activation
```bash
# Navigate to the orbital module
cd backend/orbital_risk

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment:
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env
# Linux / macOS:
# cp .env.example .env
```
Ensure `CORS_ORIGINS` includes `http://localhost:3000,http://localhost:5173`.

### Run the Server
```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Verify health:
```bash
curl http://127.0.0.1:8000/health
```

### Run Tests
```bash
pytest app/orbital_engine/tests -v
```

---

## 4. Starting Service 2: Mission Intelligence Backend (Port 8001)

The Mission Intelligence service calculates deterministic `rule_based_v1` criticality scores, identifies alternative satellites with redundancy gaps, and generates guarded AI operator briefings.

### Setup & Activation
From the **repository root**:
```bash
# Create virtual environment (if not already created)
python -m venv backend/mission_intelligence/.venv

# Activate virtual environment:
# Windows PowerShell:
.\backend\mission_intelligence\.venv\Scripts\Activate.ps1
# Linux / macOS:
# source backend/mission_intelligence/.venv/bin/activate

# Install dependencies
pip install -r backend/mission_intelligence/requirements.txt
```

### Environment Configuration
Copy `backend/mission_intelligence/.env.example` to `backend/mission_intelligence/.env`:
```bash
# Windows PowerShell:
Copy-Item backend\mission_intelligence\.env.example backend\mission_intelligence\.env
# Linux / macOS:
# cp backend/mission_intelligence/.env.example backend/mission_intelligence/.env
```
Key configuration:
* `CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"`
* `LLM_API_KEY`: *(Optional)* If omitted or invalid, briefings deterministically use verified rule-based synthesis.

### Run the Server
From the **repository root**:
```bash
uvicorn backend.mission_intelligence.app:app --host 127.0.0.1 --port 8001 --reload
```
Verify health:
```bash
curl http://127.0.0.1:8001/health
```

### Run Tests
```bash
pytest backend/mission_intelligence/tests -v -o cache_dir=backend/mission_intelligence/.pytest_cache
```

---

## 5. Starting Service 3: ASTRAVIGIL Frontend (Port 3000)

### Setup
From the **repository root**:
```bash
cd frontend

# Install dependencies
npm install
```

### Environment Configuration (`frontend/.env`)
Create or verify `frontend/.env` (git-ignored):
```env
VITE_ORBITAL_API_URL=http://localhost:8000
VITE_MISSION_API_URL=http://localhost:8001
VITE_USE_MOCK=false
```
*(To force offline mock mode for testing without backends running, set `VITE_USE_MOCK=true`)*.

### Run Development Server
```bash
npm run dev -- --host 0.0.0.0 --port 3000
```
Open **`http://localhost:3000`** in any modern web browser.

### Run Production Build Verification
```bash
npm run build
```

---

## 6. End-to-End Verification Checklist

1. **Top-Right Telemetry Chip**:
   * Displays **`LIVE TELEMETRY (REAL)`** (emerald green pulse) when both backends are responding.
   * Displays **`PARTIAL TELEMETRY (HYBRID)`** (amber badge) if one backend is stopped.
   * Displays **`SIMULATED DATA (MOCK)`** (slate/cyan badge) if both backends are stopped or `VITE_USE_MOCK=true`.
2. **Cross-Tab Consistency**:
   * Navigate between Overview, Satellite Intelligence, Risk Analysis, Mission Impact, and Alerts Centre.
   * Verify CARTOSAT-3 displays identical score (`92 / 100`), tier (`Tier 1 Critical`), and encounter geometry across all five tabs.
3. **Scientific Rule #5 Compliance**:
   * No probability or percentage fields are calculated, returned, or rendered anywhere in the interface.
   * Physical miss distance (km) and downstream mission criticality (0-100) remain strictly independent.
