"""Pydantic v2 response & request models matching ASTRAVIGIL's shared Mission API contract.

Scientific guardrails enforced at the schema level:
- ZERO collision-probability fields exist anywhere in these models.
- Criticality assessment models accept NO orbital telemetry inputs (miss distance,
  TCA, relative velocity) — physical risk and mission importance remain strictly separate.
- Every mission record and field carries explicit dataSource provenance ('real' vs 'mock').
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

DataSourceTag = Literal["real", "mock"]
CriticalityTierId = Literal[
    "TIER_1_CRITICAL",
    "TIER_2_HIGH",
    "TIER_3_MODERATE",
    "TIER_4_LOW",
]


# ---------------------------------------------------------------------------
# Standard Error Envelope
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    code: str
    message: str
    status: int
    details: Optional[dict[str, Any]] = None


class StandardErrorResponse(BaseModel):
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Mission Database & Capabilities Models
# ---------------------------------------------------------------------------

class FieldProvenance(BaseModel):
    dataSource: DataSourceTag
    sourceNote: str


class SatelliteCapabilities(BaseModel):
    sensorType: str
    sensorFamily: Literal[
        "SAR_C_BAND",
        "SAR_L_BAND",
        "OPTICAL_VHR",
        "OPTICAL_MULTISPECTRAL",
        "HYPERSPECTRAL",
        "OCEAN_MULTI_SENSOR",
        "GEO_MET_IMAGER_SOUNDER",
        "POLAR_MET_SOUNDER",
        "IONOSPHERIC_BEACON",
    ]
    allWeatherCapable: bool
    spatialResolution: str
    spatialResolutionMeters: Optional[float] = None
    revisitTime: str
    revisitDays: Optional[float] = None
    coverage: str
    coverageRegions: list[str]
    dataAccess: str
    dataAccessTier: Literal["OPEN_PUBLIC", "NATIONAL_RESTRICTED", "CHARTER_TASKED", "COMMERCIAL", "ACADEMIC"]


class SupportedEarthService(BaseModel):
    serviceId: str
    name: str
    sector: str
    impactSummary: str
    dataSource: DataSourceTag = "real"
    sourceNote: str = ""


class CriticalityFactorInput(BaseModel):
    value: int = Field(..., ge=0, le=100)
    description: str
    dataSource: DataSourceTag = "mock"
    sourceNote: str = "Analytical rule-based assessment input (not a published orbital telemetry value)."


class MissionCriticalityInputs(BaseModel):
    disasterMonitoringSupport: CriticalityFactorInput
    uniqueCapability: CriticalityFactorInput
    serviceDependency: CriticalityFactorInput
    availabilityOfAlternatives: CriticalityFactorInput
    nationalInfrastructureDefence: CriticalityFactorInput
    commercialScientificValue: CriticalityFactorInput


class SatelliteRecord(BaseModel):
    """Internal validated record loaded from mission_db.json at startup."""

    noradId: int
    verifiedNoradId: Optional[int] = None
    alternateNoradIds: list[int] = Field(default_factory=list)
    cosparId: str
    name: str
    alternateNames: list[str] = Field(default_factory=list)
    operator: str
    country: str
    category: Literal[
        "Earth Observation",
        "Disaster Monitoring",
        "Weather",
        "Scientific / Student",
        "Communication",
        "Navigation",
    ]
    orbitRegime: Literal["LEO", "MEO", "GEO"]
    orbitSubtype: str
    status: Literal["Operational", "Inactive", "Degraded", "Standby", "Decommissioned"]
    launchYear: int
    missionSummary: str
    capabilities: SatelliteCapabilities
    supportedServices: list[SupportedEarthService]
    criticalityInputs: MissionCriticalityInputs
    dataSource: DataSourceTag
    fieldProvenance: dict[str, FieldProvenance] = Field(default_factory=dict)
    sources: list[str]


# ---------------------------------------------------------------------------
# API Response Models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "astravigil-mission-intelligence"
    port: int = 8001
    satellitesLoaded: int
    methodology: str = "rule_based_v1"
    llmConfigured: bool
    dataSource: DataSourceTag = "real"


class CriticalitySummary(BaseModel):
    score: int = Field(..., ge=0, le=100)
    tier: CriticalityTierId
    tierLabel: str
    methodology: str = "rule_based_v1"


class SatelliteSummaryItem(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    cosparId: str
    name: str
    operator: str
    country: str
    category: str
    orbitRegime: str
    orbitSubtype: str
    status: str
    launchYear: int
    missionSummary: str
    capabilities: SatelliteCapabilities
    supportedServices: list[SupportedEarthService]
    criticality: CriticalitySummary
    dataSource: DataSourceTag
    sources: list[str]


class SatelliteListResponse(BaseModel):
    satellites: list[SatelliteSummaryItem]
    total: int
    methodology: str = "rule_based_v1"
    disclaimer: str = (
        "Mission metadata combines publicly verified space agency records (dataSource: 'real') "
        "with clearly marked analytical or contract-alignment fields (dataSource: 'mock')."
    )


class CapabilitiesResponse(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    name: str
    operator: str
    country: str
    category: str
    orbitRegime: str
    orbitSubtype: str
    status: str
    launchYear: int
    missionSummary: str
    capabilities: SatelliteCapabilities
    supportedServices: list[SupportedEarthService]
    dataSource: DataSourceTag
    fieldProvenance: dict[str, FieldProvenance]
    sources: list[str]


class CriticalityFactorBreakdown(BaseModel):
    id: str
    name: str
    value: int = Field(..., ge=0, le=100, description="Raw factor input value (0-100).")
    effectiveValue: int = Field(
        ...,
        ge=0,
        le=100,
        description="Effective score used in weighted sum (100 - value when inverted).",
    )
    weight: float = Field(..., gt=0.0, le=1.0)
    weightedContribution: float
    inverted: bool = False
    direction: Literal["higher_is_more_critical", "lower_is_more_critical"]
    description: str
    dataSource: DataSourceTag
    sourceNote: str


class CriticalityResponse(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    name: str
    operator: str
    category: str
    score: int = Field(..., ge=0, le=100)
    tier: CriticalityTierId
    tierLabel: str
    methodology: str = "rule_based_v1"
    formula: str
    tierThresholds: dict[str, str]
    factors: list[CriticalityFactorBreakdown]
    supportedServices: list[SupportedEarthService]
    independenceNotice: str = (
        "Mission criticality is computed purely from mission, capability, and Earth-service factors. "
        "It does not depend on orbital telemetry (miss distance, TCA, relative velocity) and does not "
        "change physical collision likelihood."
    )
    dataSource: DataSourceTag


class FieldComparisonItem(BaseModel):
    field: Literal["sensorType", "spatialResolution", "revisitTime", "coverage", "dataAccess"]
    label: str
    targetValue: str
    alternativeValue: str
    matchPoints: int
    maxPoints: int
    comparisonStatus: Literal["MATCH", "PARTIAL", "GAP"]
    limitationNote: Optional[str] = None


class AlternativeCandidate(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    name: str
    operator: str
    country: str
    category: str
    status: str
    capabilityMatch: int = Field(..., ge=0, le=100)
    comparison: list[FieldComparisonItem]
    limitations: list[str]
    dataSource: DataSourceTag
    sources: list[str]


class AlternativesResponse(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    name: str
    category: str
    matchingMethodology: str
    alternatives: list[AlternativeCandidate]
    redundancyGaps: list[str]
    caveat: str
    dataSource: DataSourceTag


# ---------------------------------------------------------------------------
# AI Briefing Request & Response Models
# ---------------------------------------------------------------------------

class BriefingRequest(BaseModel):
    """Optional conjunction screening context passed to POST /api/mission/satellites/{noradId}/briefing."""

    conjunctionId: Optional[str] = None
    secondaryNoradId: Optional[int] = None
    secondaryName: Optional[str] = Field(default=None, examples=["FENGYUN 1C DEB"])
    secondaryObjectType: Optional[Literal["DEBRIS", "PAYLOAD", "ROCKET_BODY", "UNKNOWN"]] = "DEBRIS"
    missDistanceKm: Optional[float] = Field(default=None, ge=0.0)
    relativeVelocityKms: Optional[float] = Field(default=None, ge=0.0)
    tcaUtc: Optional[str] = None
    screeningTier: Optional[str] = None
    orbitalDataSource: Optional[Literal["real", "cached_real", "simulated", "mock"]] = "mock"
    activeHazardContext: Optional[str] = Field(
        default=None,
        description="Optional terrestrial emergency note (e.g., 'Active monsoon flood warning in Assam').",
    )


class BriefingResponse(BaseModel):
    noradId: int
    verifiedNoradId: Optional[int] = None
    satelliteName: str
    conjunctionId: Optional[str] = None
    generatedBy: Literal["llm", "rule_based"]
    fallbackReason: Optional[str] = None
    model: Optional[str] = None
    headline: str
    summary: str
    physicalSeparationContext: str
    missionImportanceContext: str
    serviceImpactAndContinuity: str
    recommendedActions: list[str]
    criticalityScore: int = Field(..., ge=0, le=100)
    criticalityTier: CriticalityTierId
    scientificNotice: str
    generatedAt: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )
    dataSource: DataSourceTag
