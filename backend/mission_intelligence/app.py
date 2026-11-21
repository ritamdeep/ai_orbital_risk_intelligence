"""Standalone FastAPI entry point for ASTRAVIGIL Mission Intelligence (Member 3).

Run locally for independent testing & frontend integration:
    uvicorn backend.mission_intelligence.app:app --reload --port 8001

When integrating with Member 2's orbital backend, import `mission_router` from
`backend.mission_intelligence` instead of running a second server.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .mission_routes import router as mission_router

app = FastAPI(
    title="ASTRAVIGIL — AI & Mission Intelligence API",
    description=(
        "Member 3 module providing verified satellite mission profiles, explainable "
        "Mission Criticality & Earth Impact scoring, alternative satellite continuity "
        "matching, and scientifically grounded operational advisories."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mission_router)
