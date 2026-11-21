"""ASTRAVIGIL Backend Application Entrypoint.

AI-Powered Orbital Risk Intelligence & Satellite-Service Continuity Platform.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

from app.core.config import settings
from app.orbital_engine.router import router as orbital_router

app = FastAPI(
    title="ASTRAVIGIL API",
    description=(
        "Orbital Risk Intelligence & Satellite-Service Continuity Platform.\n\n"
        "**Module:** Orbital Risk & Debris Engine (Member 2 - `feature/orbital-risk`)\n\n"
        "Provides deterministic SGP4 propagation, catalogued space debris tracking, "
        "and preliminary close-approach screening for space sustainability."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for Member 1 (Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permissive for local hackathon collaboration
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Member 2 Router
app.include_router(orbital_router)


@app.get("/", tags=["System"])
async def root():
    """System banner and module status."""
    return {
        "platform": "ASTRAVIGIL",
        "tagline": "Beyond Collision Detection. Protecting What Satellites Make Possible.",
        "active_module": "Orbital Risk & Debris Engine",
        "active_branch": "feature/orbital-risk",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "documentation": "/docs",
    }


@app.get("/api/health", tags=["System"])
async def system_health():
    """High-level system health check."""
    return {
        "status": "HEALTHY",
        "service": "ASTRAVIGIL Backend",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
