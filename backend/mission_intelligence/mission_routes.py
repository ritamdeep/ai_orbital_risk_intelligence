"""FastAPI REST endpoints implementing ASTRAVIGIL's shared Mission Intelligence API contract.

Endpoints (port 8001):
- GET  /health
- GET  /api/mission/satellites
- GET  /api/mission/satellites/{noradId}/capabilities
- GET  /api/mission/satellites/{noradId}/criticality
- GET  /api/mission/satellites/{noradId}/alternatives
- POST /api/mission/satellites/{noradId}/briefing
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Query

from .ai_explainer import generate_briefing
from .config import CRITICALITY_METHODOLOGY, DEFAULT_PORT, get_llm_api_key
from .continuity_engine import find_alternatives
from .database import MissionDatabase, get_mission_db
from .schemas import (
    AlternativesResponse,
    BriefingRequest,
    BriefingResponse,
    CapabilitiesResponse,
    CriticalityResponse,
    HealthResponse,
    SatelliteListResponse,
    SatelliteRecord,
    SatelliteSummaryItem,
)
from .scoring_engine import compute_criticality, compute_criticality_summary


class MissionApiError(Exception):
    """Structured API error converted to the standard error envelope by app exception handlers."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


router = APIRouter(tags=["ASTRAVIGIL Mission Intelligence"])


def _require_satellite(norad_id: int, db: MissionDatabase) -> SatelliteRecord:
    satellite = db.get_by_norad_id(norad_id)
    if satellite is None:
        raise MissionApiError(
            status_code=404,
            code="SATELLITE_NOT_FOUND",
            message=f"Satellite with NORAD ID {norad_id} was not found in the mission database.",
            details={"noradId": norad_id},
        )
    return satellite


@router.get("/health", response_model=HealthResponse)
def health_check(db: MissionDatabase = Depends(get_mission_db)) -> HealthResponse:
    """Service health, loaded mission catalog size, and LLM configuration status."""
    return HealthResponse(
        status="ok",
        service="astravigil-mission-intelligence",
        port=DEFAULT_PORT,
        satellitesLoaded=db.count(),
        methodology=CRITICALITY_METHODOLOGY,
        llmConfigured=bool(get_llm_api_key()),
        dataSource="real",
    )


@router.get("/api/mission/satellites", response_model=SatelliteListResponse)
def list_satellites(
    category: Optional[str] = Query(default=None),
    operator: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: MissionDatabase = Depends(get_mission_db),
) -> SatelliteListResponse:
    """List satellites in the mission database with capabilities and criticality summaries."""
    records = db.filter_satellites(
        category=category,
        operator=operator,
        status=status,
        search=search,
    )
    items = [
        SatelliteSummaryItem(
            noradId=sat.noradId,
            verifiedNoradId=sat.verifiedNoradId,
            cosparId=sat.cosparId,
            name=sat.name,
            operator=sat.operator,
            country=sat.country,
            category=sat.category,
            orbitRegime=sat.orbitRegime,
            orbitSubtype=sat.orbitSubtype,
            status=sat.status,
            launchYear=sat.launchYear,
            missionSummary=sat.missionSummary,
            capabilities=sat.capabilities,
            supportedServices=sat.supportedServices,
            criticality=compute_criticality_summary(sat),
            dataSource=sat.dataSource,
            sources=sat.sources,
        )
        for sat in records
    ]
    return SatelliteListResponse(
        satellites=items,
        total=len(items),
        methodology=CRITICALITY_METHODOLOGY,
    )


@router.get(
    "/api/mission/satellites/{noradId}/capabilities",
    response_model=CapabilitiesResponse,
)
def get_satellite_capabilities(
    noradId: int,
    db: MissionDatabase = Depends(get_mission_db),
) -> CapabilitiesResponse:
    """Return sensor capabilities, supported Earth services, and per-field provenance."""
    sat = _require_satellite(noradId, db)
    return CapabilitiesResponse(
        noradId=sat.noradId,
        verifiedNoradId=sat.verifiedNoradId,
        name=sat.name,
        operator=sat.operator,
        country=sat.country,
        category=sat.category,
        orbitRegime=sat.orbitRegime,
        orbitSubtype=sat.orbitSubtype,
        status=sat.status,
        launchYear=sat.launchYear,
        missionSummary=sat.missionSummary,
        capabilities=sat.capabilities,
        supportedServices=sat.supportedServices,
        dataSource=sat.dataSource,
        fieldProvenance=sat.fieldProvenance,
        sources=sat.sources,
    )


@router.get(
    "/api/mission/satellites/{noradId}/criticality",
    response_model=CriticalityResponse,
)
def get_satellite_criticality(
    noradId: int,
    db: MissionDatabase = Depends(get_mission_db),
) -> CriticalityResponse:
    """Return deterministic rule_based_v1 criticality score, tier, and weighted factor breakdown."""
    sat = _require_satellite(noradId, db)
    return compute_criticality(sat)


@router.get(
    "/api/mission/satellites/{noradId}/alternatives",
    response_model=AlternativesResponse,
)
def get_satellite_alternatives(
    noradId: int,
    maxResults: int = Query(default=5, ge=1, le=10),
    db: MissionDatabase = Depends(get_mission_db),
) -> AlternativesResponse:
    """Return overlapping alternative satellites, per-field comparisons, redundancy gaps, and caveat."""
    sat = _require_satellite(noradId, db)
    return find_alternatives(sat, db, max_results=maxResults)


@router.post(
    "/api/mission/satellites/{noradId}/briefing",
    response_model=BriefingResponse,
)
def create_satellite_briefing(
    noradId: int,
    payload: Optional[BriefingRequest] = Body(default=None),
    db: MissionDatabase = Depends(get_mission_db),
) -> BriefingResponse:
    """Generate a natural-language operator briefing from structured mission & screening context."""
    sat = _require_satellite(noradId, db)
    request_data = payload or BriefingRequest()
    criticality = compute_criticality(sat)
    alternatives = find_alternatives(sat, db, max_results=5)
    return generate_briefing(sat, criticality, alternatives, request_data)
