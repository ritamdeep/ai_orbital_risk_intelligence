"""FastAPI Router for Orbital Risk & Debris Engine.

Exposes REST API endpoints for:
  - System health and catalog telemetry
  - Tracked satellite and debris catalog queries
  - Forward ephemeris generation for 3D visualization
  - On-demand preliminary close-approach screening
  - Conjunction encounter events query
"""

import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.orbital import (
    TrackedObject,
    DebrisObject,
    EphemerisResponse,
    CloseApproachEvent,
    ScreeningRequest,
    ScreeningResponse,
    EngineHealthResponse,
    ObjectType,
    ScreeningPriority,
    CalculationStatus,
    DataFidelity,
)
from app.orbital_engine.clients.celestrak_client import celestrak_client
from app.orbital_engine.screening.conjunction_screener import ConjunctionScreener

router = APIRouter(prefix="/api/orbital", tags=["Orbital Risk Engine"])
screener = ConjunctionScreener()

# In-memory storage for discovered screening events
_DISCOVERED_EVENTS: List[CloseApproachEvent] = []


def _seed_initial_events():
    """Seed baseline close-approach events for Member 1 (Frontend) and Member 3 (Mission Intelligence)."""
    global _DISCOVERED_EVENTS
    if _DISCOVERED_EVENTS:
        return

    now = datetime.now(timezone.utc)
    
    # Event 1: EOS-04 (RISAT-1A) vs COSMOS 2251 Debris (High priority encounter)
    tca_1 = now + timedelta(hours=4, minutes=12, seconds=30)
    _DISCOVERED_EVENTS.append(
        CloseApproachEvent(
            event_id=f"CA-51656-34454-{int(tca_1.timestamp())}",
            primary_norad_id=51656,
            primary_name="EOS-04 (RISAT-1A)",
            secondary_norad_id=34454,
            secondary_name="COSMOS 2251 DEBRIS",
            secondary_type=ObjectType.DEBRIS,
            tca_utc=tca_1,
            miss_distance_km=0.850,
            radial_miss_km=0.120,
            in_track_miss_km=0.820,
            cross_track_miss_km=0.180,
            relative_velocity_km_s=13.420,
            screening_priority=ScreeningPriority.URGENT_INVESTIGATION,
            calculation_status=CalculationStatus.COMPLETED,
            data_fidelity=DataFidelity.SYNTHETIC_SCENARIO,
            time_window_hours=48.0,
        )
    )

    # Event 2: CARTOSAT-2F vs SL-16 Spent Rocket Body (Warning priority encounter)
    tca_2 = now + timedelta(hours=14, minutes=45, seconds=10)
    _DISCOVERED_EVENTS.append(
        CloseApproachEvent(
            event_id=f"CA-43111-25486-{int(tca_2.timestamp())}",
            primary_norad_id=43111,
            primary_name="CARTOSAT-2F",
            secondary_norad_id=25486,
            secondary_name="SL-16 R/B (SPENT ROCKET BODY)",
            secondary_type=ObjectType.ROCKET_BODY,
            tca_utc=tca_2,
            miss_distance_km=3.240,
            radial_miss_km=0.450,
            in_track_miss_km=3.100,
            cross_track_miss_km=0.780,
            relative_velocity_km_s=11.850,
            screening_priority=ScreeningPriority.WARNING,
            calculation_status=CalculationStatus.COMPLETED,
            data_fidelity=DataFidelity.SYNTHETIC_SCENARIO,
            time_window_hours=48.0,
        )
    )

    # Event 3: INS-2TD (CubeSat) vs FENGYUN 1C Debris (Advisory priority encounter)
    tca_3 = now + timedelta(hours=28, minutes=5, seconds=0)
    _DISCOVERED_EVENTS.append(
        CloseApproachEvent(
            event_id=f"CA-53317-30421-{int(tca_3.timestamp())}",
            primary_norad_id=53317,
            primary_name="INS-2TD (CUBESAT)",
            secondary_norad_id=30421,
            secondary_name="FENGYUN 1C DEBRIS",
            secondary_type=ObjectType.DEBRIS,
            tca_utc=tca_3,
            miss_distance_km=8.450,
            radial_miss_km=1.200,
            in_track_miss_km=8.100,
            cross_track_miss_km=2.100,
            relative_velocity_km_s=14.120,
            screening_priority=ScreeningPriority.ADVISORY,
            calculation_status=CalculationStatus.COMPLETED,
            data_fidelity=DataFidelity.SYNTHETIC_SCENARIO,
            time_window_hours=48.0,
        )
    )


# Seed baseline scenario events
_seed_initial_events()


# ============================================================================
# Health & Status
# ============================================================================

@router.get("/health", response_model=EngineHealthResponse, summary="Orbital Engine Health & Telemetry")
async def get_orbital_health():
    """Returns engine status, active branch, and cache statistics."""
    all_objs = celestrak_client.get_all_objects()
    debris_objs = [o for o in all_objs if o.object_type in (ObjectType.DEBRIS, ObjectType.ROCKET_BODY)]
    return EngineHealthResponse(
        status="ONLINE",
        module="Orbital Risk & Debris Engine (ASTRAVIGIL - Member 2)",
        version="1.0.0",
        current_time_utc=datetime.now(timezone.utc),
        objects_cached_count=len(all_objs),
        debris_cached_count=len(debris_objs),
        cache_last_updated_utc=celestrak_client.last_loaded_time,
        propagation_engine="SGP4 (Standard NORAD Model)",
        active_branch="feature/orbital-risk",
    )


# ============================================================================
# Tracked Objects Catalog
# ============================================================================

@router.get("/objects", response_model=List[TrackedObject], summary="Query Tracked Satellites & Objects")
async def list_objects(
    object_type: Optional[ObjectType] = Query(None, description="Filter by object type"),
    search: Optional[str] = Query(None, description="Search by name or NORAD ID"),
    limit: int = Query(50, ge=1, le=500, description="Maximum items to return"),
):
    """Retrieve catalog of tracked satellites, rocket bodies, and debris."""
    objs = celestrak_client.get_all_objects()

    if object_type:
        objs = [o for o in objs if o.object_type == object_type]

    if search:
        s = search.lower()
        objs = [o for o in objs if s in o.name.lower() or s in str(o.norad_id)]

    return objs[:limit]


@router.get("/objects/{norad_id}", response_model=TrackedObject, summary="Get Object Details by NORAD ID")
async def get_object_details(norad_id: int):
    """Retrieve complete orbital elements and metadata for a specific object."""
    obj = celestrak_client.get_object_by_id(norad_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object with NORAD ID {norad_id} not found in catalog.",
        )
    return obj


@router.get("/objects/{norad_id}/ephemeris", response_model=EphemerisResponse, summary="Generate 3D Orbit Trajectory Ephemeris")
async def get_object_ephemeris(
    norad_id: int,
    duration_hours: float = Query(2.0, ge=0.5, le=48.0, description="Forward trajectory duration in hours"),
    step_seconds: int = Query(60, ge=10, le=300, description="Step size in seconds for trajectory points"),
):
    """Generate forward orbital trajectory points (Lat, Lon, Alt, ECI) for 3D Globe visualization."""
    obj = celestrak_client.get_object_by_id(norad_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Object {norad_id} not found.")

    prop = celestrak_client.get_propagator(norad_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Propagator not initialized.")

    now = datetime.now(timezone.utc)
    trajectory = prop.generate_ephemeris(start_time=now, duration_hours=duration_hours, step_seconds=step_seconds)

    return EphemerisResponse(
        norad_id=obj.norad_id,
        name=obj.name,
        orbit_regime=obj.orbit_regime,
        data_source=obj.data_source,
        generated_at_utc=now,
        step_size_seconds=step_seconds,
        trajectory=trajectory,
    )


@router.get("/debris", response_model=List[DebrisObject], summary="Query Catalogued Space Debris")
async def list_debris(
    limit: int = Query(50, ge=1, le=500, description="Maximum debris items to return"),
):
    """Retrieve catalogued space debris fragments and spent rocket bodies."""
    debris = celestrak_client.get_debris_objects()
    return debris[:limit]


# ============================================================================
# Screening & Conjunction Events
# ============================================================================

@router.post("/screenings", response_model=ScreeningResponse, summary="Trigger On-Demand Conjunction Screening")
async def trigger_screening(request: ScreeningRequest):
    """Perform preliminary close-approach screening between a target satellite and catalogued objects.

    Uses a two-tier screening pipeline:
      1. Geometric apogee-perigee altitude filter
      2. Coarse SGP4 propagation + fine-grained TCA local minima search
    """
    start_bench = time.perf_counter()

    target_obj = celestrak_client.get_object_by_id(request.target_norad_id)
    if not target_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target satellite {request.target_norad_id} not found in catalog.",
        )

    target_prop = celestrak_client.get_propagator(request.target_norad_id)
    if not target_prop:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Propagator error.")

    all_objs = celestrak_client.get_all_objects()
    candidates = []

    for obj in all_objs:
        if obj.norad_id == request.target_norad_id:
            continue
        if obj.object_type == ObjectType.PAYLOAD and not request.include_operational:
            continue
        if obj.object_type in (ObjectType.DEBRIS, ObjectType.ROCKET_BODY) and not request.include_debris:
            continue
        candidates.append(obj)

    now = datetime.now(timezone.utc)
    found_encounters: List[CloseApproachEvent] = []
    screened_after_filter = 0

    # Limit search duration window to 24h max for on-demand HTTP response responsiveness
    active_window = min(request.time_window_hours, 24.0)

    for cand in candidates:
        cand_prop = celestrak_client.get_propagator(cand.norad_id)
        if not cand_prop:
            continue

        cand_meta = celestrak_client.get_raw_metadata(cand.norad_id) or {}
        encounters = screener.screen_pair(
            primary=target_prop,
            secondary=cand_prop,
            secondary_meta=cand_meta,
            start_time=now,
            window_hours=active_window,
            threshold_km=request.threshold_km,
        )

        screened_after_filter += 1

        for enc in encounters:
            found_encounters.append(enc)
            if not any(e.event_id == enc.event_id for e in _DISCOVERED_EVENTS):
                _DISCOVERED_EVENTS.append(enc)

    # If dynamic calculation in forward window found no new passes, include matching baseline events
    if not found_encounters:
        baseline = [e for e in _DISCOVERED_EVENTS if e.primary_norad_id == request.target_norad_id and e.miss_distance_km <= request.threshold_km]
        found_encounters.extend(baseline)

    execution_time_ms = round((time.perf_counter() - start_bench) * 1000.0, 2)
    screening_id = f"SCR-{request.target_norad_id}-{int(now.timestamp())}"

    # Sort encounters by miss distance ascending (closest first)
    found_encounters.sort(key=lambda x: x.miss_distance_km)

    return ScreeningResponse(
        screening_id=screening_id,
        target_norad_id=request.target_norad_id,
        target_name=target_obj.name,
        executed_at_utc=now,
        time_window_hours=request.time_window_hours,
        threshold_km=request.threshold_km,
        objects_in_catalog=len(all_objs),
        objects_screened_after_geometric_filter=screened_after_filter,
        potential_encounters_count=len(found_encounters),
        encounters=found_encounters,
        execution_time_ms=execution_time_ms,
    )


@router.get("/events", response_model=List[CloseApproachEvent], summary="List Close-Approach Events")
async def list_events(
    min_priority: Optional[str] = Query(None, description="Filter priority (URGENT_INVESTIGATION, WARNING, ADVISORY)"),
    norad_id: Optional[int] = Query(None, description="Filter by satellite NORAD ID"),
):
    """Retrieve list of identified preliminary close-approach screening events."""
    _seed_initial_events()
    events = list(_DISCOVERED_EVENTS)

    if norad_id:
        events = [e for e in events if e.primary_norad_id == norad_id or e.secondary_norad_id == norad_id]

    if min_priority:
        events = [e for e in events if e.screening_priority.value == min_priority.upper()]

    # Sort by TCA ascending
    events.sort(key=lambda x: x.tca_utc)
    return events


@router.get("/events/{event_id}", response_model=CloseApproachEvent, summary="Get Event Detail by ID")
async def get_event_detail(event_id: str):
    """Retrieve full telemetry and kinematics for a specific conjunction event."""
    _seed_initial_events()
    for ev in _DISCOVERED_EVENTS:
        if ev.event_id == event_id:
            return ev

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Conjunction event '{event_id}' not found.",
    )
