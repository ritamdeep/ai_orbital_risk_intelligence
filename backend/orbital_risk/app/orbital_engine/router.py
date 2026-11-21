"""FastAPI Router for ASTRAVIGIL Orbital Risk Engine.

Implements the shared contract endpoints:
  - GET /health
  - GET /api/orbital/satellites (with type filter)
  - GET /api/orbital/satellites/{noradId}
  - GET /api/orbital/conjunctions (with windowHours and maxSeparationKm)
  - GET /api/orbital/conjunctions/{eventId}
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.orbital import (
    SatelliteSummary,
    ConjunctionEvent,
    HealthResponse,
    ErrorResponse,
    ErrorDetail,
)
from app.orbital_engine.clients.celestrak_client import data_store
from app.orbital_engine.screening.conjunction_screener import screener

router = APIRouter(tags=["Orbital Risk Engine"])


# ============================================================================
# Health Endpoint
# ============================================================================

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Orbital Engine Health & Telemetry",
    tags=["System"],
)
async def get_health():
    """Returns service health status, TLE provenance (celestrak/mock), and object count."""
    now = datetime.now(timezone.utc)
    tle_source = "celestrak" if data_store.is_live else "mock"
    return HealthResponse(
        status="healthy",
        service="astravigil-orbital-backend",
        version="1.0.0",
        timestampUtc=now.isoformat(),
        tleSource=tle_source,
        objectsCount=data_store.total_count,
    )


# ============================================================================
# Satellite Catalog Endpoints
# ============================================================================

@router.get(
    "/api/orbital/satellites",
    response_model=List[SatelliteSummary],
    responses={422: {"model": ErrorResponse}},
    summary="Query Tracked Satellites & Space Debris",
)
async def list_satellites(
    type: Optional[str] = Query(None, description="Filter by object type: 'payload', 'debris', 'rocket_body'"),
):
    """Retrieve catalogued operational satellites and space debris with current SGP4 positions."""
    return data_store.get_all_satellites(type_filter=type)


@router.get(
    "/api/orbital/satellites/{noradId}",
    response_model=SatelliteSummary,
    responses={
        404: {"model": ErrorResponse, "description": "Satellite not found"},
        422: {"model": ErrorResponse, "description": "Invalid parameter"},
    },
    summary="Get Satellite by NORAD ID",
)
async def get_satellite(noradId: int):
    """Retrieve details and real-time SGP4 position for a specific satellite or debris object."""
    summary = data_store.get_satellite_summary(noradId)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Satellite with NORAD ID {noradId} not found in catalog",
        )
    return summary


# ============================================================================
# Conjunction Screening Endpoints
# ============================================================================

@router.get(
    "/api/orbital/conjunctions",
    response_model=List[ConjunctionEvent],
    responses={422: {"model": ErrorResponse}},
    summary="Get Flagged Close-Approach Conjunction Events",
)
async def list_conjunctions(
    windowHours: float = Query(48.0, ge=1.0, le=168.0, description="Forward forecast window in hours (1-168)"),
    maxSeparationKm: float = Query(100.0, ge=0.1, le=500.0, description="Maximum miss distance threshold in km"),
    window_hours: Optional[float] = Query(None, description="Alias for windowHours"),
    max_separation_km: Optional[float] = Query(None, description="Alias for maxSeparationKm"),
):
    """Screen priority operational satellites against catalogued debris over windowHours.

    Results are cached for ~60 seconds to ensure high API performance.
    """
    effective_window = window_hours if window_hours is not None else windowHours
    effective_max_sep = max_separation_km if max_separation_km is not None else maxSeparationKm

    # Partition priority operational satellites from debris catalog
    all_objs = data_store.get_all_satellites()
    priority_satellites = [o for o in all_objs if o.type == "payload"]
    debris_objects = [o for o in all_objs if o.type in ("debris", "rocket_body")]

    propagators = {norad_id: data_store.get_propagator(norad_id) for norad_id in data_store._propagators.keys()}

    events = screener.screen_all(
        priority_satellites=priority_satellites,
        debris_objects=debris_objects,
        propagators=propagators,
        window_hours=effective_window,
        max_separation_km=effective_max_sep,
    )
    return events


@router.get(
    "/api/orbital/conjunctions/{eventId}",
    response_model=ConjunctionEvent,
    responses={
        404: {"model": ErrorResponse, "description": "Conjunction event not found"},
        422: {"model": ErrorResponse, "description": "Invalid parameter"},
    },
    summary="Get Conjunction Event by Event ID",
)
async def get_conjunction_event(eventId: str):
    """Retrieve details and encounter kinematics for a specific conjunction event."""
    from app.orbital_engine.screening.conjunction_screener import _SCREENING_CACHE

    # Check already-cached screening runs
    for _, cached_events in _SCREENING_CACHE.values():
        for ev in cached_events:
            if ev.eventId.upper() == eventId.upper():
                return ev

    # If not in cache, screen across wide bounds to locate the event
    all_objs = data_store.get_all_satellites()
    priority_satellites = [o for o in all_objs if o.type == "payload"]
    debris_objects = [o for o in all_objs if o.type in ("debris", "rocket_body")]
    propagators = {norad_id: data_store.get_propagator(norad_id) for norad_id in data_store._propagators.keys()}

    events = screener.screen_all(
        priority_satellites=priority_satellites,
        debris_objects=debris_objects,
        propagators=propagators,
        window_hours=168.0,
        max_separation_km=200.0,
    )

    for ev in events:
        if ev.eventId.upper() == eventId.upper():
            return ev

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Conjunction event with ID '{eventId}' not found",
    )
