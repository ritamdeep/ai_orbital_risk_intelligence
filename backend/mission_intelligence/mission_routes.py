"""FastAPI REST endpoints for ASTRAVIGIL Mission Intelligence (Member 3).

Exposed endpoints:
- GET  /api/health
- GET  /api/missions
- GET  /api/missions/{norad_id}
- POST /api/analyze-impact
- GET  /api/alternatives/{norad_id}

Mount into a unified FastAPI backend with:
    from backend.mission_intelligence import mission_router
    app.include_router(mission_router)
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .ai_explainer import generate_risk_explanation, get_llm_status
from .continuity_engine import run_continuity_analysis
from .database import MissionDatabase, get_mission_db
from .schemas import (
    ActiveEarthEvent,
    ConjunctionAlertInput,
    ContinuityAnalysisResponse,
    DataProvenance,
    ImpactAnalysisResponse,
    MissionListResponse,
    MissionProfileResponse,
    MissionType,
    SensorModality,
    SeverityTier,
)
from .scoring_engine import (
    compute_earth_impact,
    compute_explainable_priority,
    compute_mission_criticality,
)

router = APIRouter(prefix="/api", tags=["ASTRAVIGIL Mission Intelligence"])


@router.get("/health")
def health_check(db: MissionDatabase = Depends(get_mission_db)) -> dict[str, object]:
    """Verify module health, curated mission catalog count, and AI explainer mode."""
    return {
        "status": "ok",
        "module": "mission_intelligence",
        "catalog_satellites_loaded": db.count(),
        "catalog_version": db.metadata.get("schema_version", "1.0.0"),
        "ai_explainer": get_llm_status(),
    }


@router.get("/missions", response_model=MissionListResponse)
def list_missions(
    mission_type: Optional[MissionType] = Query(default=None),
    country: Optional[str] = Query(default=None),
    service_id: Optional[str] = Query(default=None),
    sensor_modality: Optional[SensorModality] = Query(default=None),
    region: Optional[str] = Query(default=None),
    db: MissionDatabase = Depends(get_mission_db),
) -> MissionListResponse:
    """List verified satellite missions with optional filters for frontend catalogs."""
    satellites = db.filter_missions(
        mission_type=mission_type,
        country=country,
        service_id=service_id,
        sensor_modality=sensor_modality,
        region=region,
    )
    return MissionListResponse(
        total=len(satellites),
        satellites=satellites,
        provenance=DataProvenance(
            mission_data_provenance="verified_public_catalog",
            conjunction_data_provenance="real",
        ),
    )


@router.get("/missions/{norad_id}", response_model=MissionProfileResponse)
def get_mission_profile(
    norad_id: int,
    db: MissionDatabase = Depends(get_mission_db),
) -> MissionProfileResponse:
    """Return satellite mission profile, sensor capabilities, and baseline criticality."""
    mission = db.get_by_norad_id(norad_id)
    if mission is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "MISSION_NOT_FOUND",
                "norad_id": norad_id,
                "message": (
                    f"NORAD ID {norad_id} is not in ASTRAVIGIL's verified mission catalog. "
                    "Use GET /api/missions to inspect catalogued satellites."
                ),
            },
        )

    return MissionProfileResponse(
        mission=mission,
        baseline_criticality=compute_mission_criticality(mission),
        baseline_earth_impact=compute_earth_impact(mission),
        provenance=DataProvenance(
            mission_data_provenance="verified_public_catalog",
            conjunction_data_provenance="real",
        ),
    )


@router.get("/alternatives/{norad_id}", response_model=ContinuityAnalysisResponse)
def get_alternative_satellites(
    norad_id: int,
    max_results: int = Query(default=5, ge=1, le=10),
    active_event_type: Optional[str] = Query(
        default=None,
        description="Optional active disaster context (e.g., flood_alert, cyclone_alert).",
    ),
    active_region: Optional[str] = Query(
        default=None,
        description="Optional region for active disaster context (e.g., Assam, India).",
    ),
    db: MissionDatabase = Depends(get_mission_db),
) -> ContinuityAnalysisResponse:
    """Return overlapping backup satellites, service disruptions, and redundancy gaps."""
    mission = db.get_by_norad_id(norad_id)
    if mission is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "MISSION_NOT_FOUND",
                "norad_id": norad_id,
                "message": (
                    f"Cannot compute verified alternatives because NORAD ID {norad_id} is not "
                    "present in ASTRAVIGIL's mission database."
                ),
            },
        )

    events: list[ActiveEarthEvent] = []
    if active_event_type:
        try:
            events.append(
                ActiveEarthEvent(
                    event_type=active_event_type,  # type: ignore[arg-type]
                    region=active_region or "India",
                    severity=SeverityTier.HIGH,
                )
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid active_event_type: {exc}") from exc

    return run_continuity_analysis(
        norad_id,
        db,
        active_earth_events=events,
        max_results=max_results,
        conjunction_provenance="real",
    )


@router.post("/analyze-impact", response_model=ImpactAnalysisResponse)
def analyze_conjunction_impact(
    alert: ConjunctionAlertInput,
    db: MissionDatabase = Depends(get_mission_db),
) -> ImpactAnalysisResponse:
    """Analyze a conjunction alert from Member 2's Orbital Risk Engine.

    Returns:
    - Explainable Priority Score (Orbital Risk × Mission Criticality × Earth Impact)
      with all three dimensions kept distinct from raw collision probability.
    - Earth-level service disruption & redundancy gap analysis.
    - Overlapping alternative satellite recommendations with limitations.
    - Plain-language AI operational advisory (with deterministic fallback).
    """
    mission = db.get_by_norad_id(alert.primary_norad_id)
    target_name = mission.name if mission else (alert.primary_name or f"NORAD {alert.primary_norad_id}")
    event_id = (
        alert.event_id
        or f"ca-{alert.primary_norad_id}-{alert.secondary_norad_id or 'unk'}-{alert.tca_utc}"
    )

    priority_result = compute_explainable_priority(alert, mission)
    continuity = run_continuity_analysis(
        alert.primary_norad_id,
        db,
        active_earth_events=alert.active_earth_events,
        max_results=alert.max_alternatives,
        conjunction_provenance=alert.data_provenance,
        target_name_fallback=target_name,
    )

    advisory = None
    if alert.include_ai_explanation:
        advisory = generate_risk_explanation(
            alert=alert,
            mission=mission,
            priority=priority_result,
            disruptions=continuity.disrupted_services,
            gaps=continuity.redundancy_gaps,
            alternatives=continuity.alternatives,
        )

    return ImpactAnalysisResponse(
        event_id=event_id,
        target_norad_id=alert.primary_norad_id,
        target_name=target_name,
        is_catalogued_mission=mission is not None,
        mission_profile=mission,
        priority_assessment=priority_result,
        disrupted_services=continuity.disrupted_services,
        redundancy_gaps=continuity.redundancy_gaps,
        alternative_satellites=continuity.alternatives,
        overall_continuity_assessment=continuity.overall_continuity_assessment,
        ai_advisory=advisory,
        provenance=DataProvenance(
            mission_data_provenance=(
                "verified_public_catalog" if mission is not None else "uncatalogued_fallback"
            ),
            conjunction_data_provenance=alert.data_provenance,
        ),
    )
