"""Pydantic v2 schemas and shared API contracts for ASTRAVIGIL Mission Intelligence.

Design guardrails (ASTRAVIGIL Scientific Rules):
- Physical orbital screening metrics, mission criticality, and Earth-level impact
  are modeled as distinct dimensions.
- The Explainable Priority Score is an operational triage index, NEVER a physical
  collision probability (Pc).
- Unknown technical specs are represented explicitly as None (never fabricated).
- Data provenance distinguishes real catalog data from simulated scenarios.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class OrbitRegime(str, Enum):
    LEO = "LEO"
    MEO = "MEO"
    GEO = "GEO"


class MissionType(str, Enum):
    EARTH_OBSERVATION = "earth_observation"
    DISASTER_MONITORING = "disaster_monitoring"
    WEATHER_METEOROLOGY = "weather_meteorology"
    COMMUNICATIONS = "communications"
    NAVIGATION = "navigation"
    EXPERIMENTAL_CUBESAT = "experimental_cubesat"


class OperatorTier(str, Enum):
    NATIONAL_AGENCY = "national_agency"
    INTERNATIONAL_AGENCY = "international_agency"
    COMMERCIAL_STARTUP = "commercial_startup"
    UNIVERSITY_EXPERIMENTAL = "university_experimental"


class SensorModality(str, Enum):
    SAR_C_BAND = "SAR_C_BAND"
    SAR_L_BAND = "SAR_L_BAND"
    OPTICAL_VHR = "OPTICAL_VHR"
    OPTICAL_MULTISPECTRAL = "OPTICAL_MULTISPECTRAL"
    HYPERSPECTRAL = "HYPERSPECTRAL"
    THERMAL_IR = "THERMAL_IR"
    GEO_IMAGER_SOUNDER = "GEO_IMAGER_SOUNDER"
    SCATTEROMETER = "SCATTEROMETER"
    OCEAN_COLOR = "OCEAN_COLOR"
    GNSS_R = "GNSS_R"
    COMMS_TRANSPONDER = "COMMS_TRANSPONDER"
    PNT_NAVIGATION = "PNT_NAVIGATION"
    SEARCH_AND_RESCUE = "SEARCH_AND_RESCUE"


class SeverityTier(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"


class ScreeningTier(str, Enum):
    IMMEDIATE_CDM_REVIEW = "IMMEDIATE_CDM_REVIEW"
    ELEVATED_REVIEW = "ELEVATED_REVIEW"
    ENHANCED_MONITORING = "ENHANCED_MONITORING"
    ROUTINE_SCREENING = "ROUTINE_SCREENING"


class PriorityBand(str, Enum):
    CRITICAL_PRIORITY = "CRITICAL_PRIORITY"
    HIGH_PRIORITY = "HIGH_PRIORITY"
    ELEVATED_MONITORING = "ELEVATED_MONITORING"
    ROUTINE_WATCH = "ROUTINE_WATCH"


class AlternativeMatchClass(str, Enum):
    SAME_CONSTELLATION_PEER = "SAME_CONSTELLATION_PEER"
    STRONG_PARTIAL_ALTERNATIVE = "STRONG_PARTIAL_ALTERNATIVE"
    PARTIAL_CAPABILITY_MATCH = "PARTIAL_CAPABILITY_MATCH"
    COMPLEMENTARY_SUPPORT_ONLY = "COMPLEMENTARY_SUPPORT_ONLY"


class DataProvenance(BaseModel):
    mission_data_source: str = Field(
        default="ASTRAVIGIL Curated Public Mission Catalog (ISRO, WMO OSCAR, ESA, NASA/USGS, CEOS)"
    )
    mission_data_provenance: Literal["verified_public_catalog", "uncatalogued_fallback"] = (
        "verified_public_catalog"
    )
    conjunction_data_provenance: Literal["real", "cached_real", "simulated_scenario", "mock"] = (
        "simulated_scenario"
    )
    evaluated_at_utc: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )
    scientific_disclaimer: str = Field(
        default=(
            "Preliminary close-approach screening is not a validated Conjunction Data Message (CDM). "
            "Mission criticality and Earth impact guide operational triage and do not alter physical "
            "collision probability. Public catalogs track catalogued objects only and cannot "
            "individually track small untracked debris fragments."
        )
    )


class SensorCapability(BaseModel):
    name: str
    modality: SensorModality
    all_weather_capable: bool
    day_night_capable: bool
    spatial_resolution_m: Optional[float] = Field(
        default=None,
        description="Best publicly verified ground sample distance in meters; null if not applicable or unverified.",
    )
    swath_km: Optional[float] = Field(
        default=None,
        description="Nominal swath width in km; null if not applicable or unverified.",
    )
    notes: str = ""


class ServiceDependency(BaseModel):
    service_id: str
    service_name: str
    criticality_tier: SeverityTier
    dependent_sectors: list[str]
    disruption_consequence: str


class CriticalityFactors(BaseModel):
    disaster_response_reliance: float = Field(..., ge=0.0, le=1.0)
    service_dependency_breadth: float = Field(..., ge=0.0, le=1.0)
    domestic_redundancy_scarcity: float = Field(..., ge=0.0, le=1.0)
    sensor_uniqueness: float = Field(..., ge=0.0, le=1.0)


class SatelliteMission(BaseModel):
    norad_id: int
    cospar_id: str
    name: str
    alternate_names: list[str] = Field(default_factory=list)
    operator: str
    country: str
    operator_tier: OperatorTier
    orbit_regime: OrbitRegime
    orbit_type: str
    mission_type: MissionType
    mission_categories: list[str]
    launch_date: str
    mission_summary: str
    sensors: list[SensorCapability]
    revisit_time_days: Optional[float] = Field(
        default=None,
        description="Nominal revisit interval in days (0.01 for continuous GEO imaging); null if unverified/N/A.",
    )
    coverage_regions: list[str]
    active_service_dependencies: list[ServiceDependency]
    constellation_peers: list[int] = Field(default_factory=list)
    data_access_model: str
    disaster_charter_eligible: bool
    mission_criticality_factors: CriticalityFactors
    sources: list[str]
    data_provenance: Literal["verified_public_catalog"] = "verified_public_catalog"


class ActiveEarthEvent(BaseModel):
    """Optional real-world or scenario disaster context that increases Earth-level impact."""

    event_type: Literal[
        "flood_alert",
        "cyclone_alert",
        "earthquake_alert",
        "landslide_alert",
        "wildfire_alert",
        "drought_alert",
        "telecom_outage",
        "maritime_emergency",
    ]
    region: str = Field(..., examples=["Assam / Brahmaputra Basin, India"])
    severity: SeverityTier = SeverityTier.HIGH
    description: Optional[str] = None


class ConjunctionAlertInput(BaseModel):
    """Input payload from Member 2's Orbital Risk Engine into POST /api/analyze-impact."""

    event_id: Optional[str] = Field(
        default=None,
        description="Unique conjunction screening identifier from Member 2.",
    )
    primary_norad_id: int = Field(..., description="NORAD Catalog ID of the protected active satellite.")
    primary_name: Optional[str] = Field(
        default=None,
        description="Optional satellite name from orbital catalog (used if unmapped in mission DB).",
    )
    secondary_norad_id: Optional[int] = Field(
        default=None,
        description="NORAD Catalog ID of the approaching catalogued object or debris.",
    )
    secondary_name: str = Field(
        default="UNKNOWN CATALOGUED OBJECT",
        description="Name of the secondary object (e.g., FENGYUN 1C DEB).",
    )
    secondary_object_type: Literal["DEBRIS", "PAYLOAD", "ROCKET_BODY", "UNKNOWN"] = "DEBRIS"
    tca_utc: str = Field(..., description="Time of Closest Approach in ISO-8601 UTC.")
    miss_distance_km: float = Field(..., ge=0.0, description="Preliminary SGP4 minimum miss distance in km.")
    relative_velocity_kms: float = Field(
        ..., ge=0.0, description="Relative encounter speed at TCA in km/s."
    )
    orbital_risk_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description=(
            "Optional pre-normalized orbital screening score (0.0-1.0) from Member 2. "
            "If omitted, derived transparently from miss_distance_km and relative_velocity_kms."
        ),
    )
    tle_epoch_age_hours: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Age of the primary/secondary TLE epoch in hours (used for uncertainty caveats).",
    )
    active_earth_events: list[ActiveEarthEvent] = Field(
        default_factory=list,
        description="Active disaster or emergency alerts that dynamically boost Earth-level service impact.",
    )
    data_provenance: Literal["real", "cached_real", "simulated_scenario", "mock"] = (
        "simulated_scenario"
    )
    include_ai_explanation: bool = Field(
        default=True,
        description="Whether to generate plain-language operational advisory.",
    )
    max_alternatives: int = Field(default=5, ge=1, le=10)


class WeightedCriterion(BaseModel):
    criterion: str
    weight: float
    raw_score: float
    weighted_contribution: float
    rationale: str


class ContextMultiplierApplied(BaseModel):
    event_type: str
    region: str
    severity: SeverityTier
    matched_services: list[str]
    region_matched: bool
    multiplier: float
    rationale: str


class OrbitalScreeningDimension(BaseModel):
    """Physical screening dimension — strictly separated from mission criticality."""

    orbital_risk_score: float = Field(..., ge=0.0, le=1.0)
    screening_tier: ScreeningTier
    miss_distance_km: float
    relative_velocity_kms: float
    tca_utc: str
    tle_epoch_age_hours: Optional[float] = None
    tle_freshness_note: str
    collision_probability: None = Field(
        default=None,
        description="Always null: public TLE screening lacks covariance matrices needed for physical Pc.",
    )
    physical_assessment_note: str
    score_derivation: str


class MissionCriticalityDimension(BaseModel):
    """Intrinsic importance of the satellite mission — independent of collision physics."""

    mission_criticality_score: float = Field(..., ge=0.0, le=1.0)
    criticality_tier: SeverityTier
    formula: str
    criteria_breakdown: list[WeightedCriterion]
    is_catalogued_mission: bool = True


class EarthImpactDimension(BaseModel):
    """Terrestrial service disruption severity with transparent dynamic context multipliers."""

    base_earth_impact_score: float = Field(..., ge=0.0, le=1.0)
    dynamic_context_multiplier: float = Field(..., ge=1.0)
    effective_earth_impact_score: float = Field(..., ge=0.0, le=1.0)
    uncapped_earth_impact_score: float = Field(..., ge=0.0)
    earth_impact_tier: SeverityTier
    applied_multipliers: list[ContextMultiplierApplied] = Field(default_factory=list)
    service_weights_summary: list[dict[str, Any]]


class ExplainablePriorityResult(BaseModel):
    """Combined operational triage priority (distinct from physical collision probability)."""

    explainable_priority_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Operational triage index (0-100) = Orbital Risk × Mission Criticality × Effective Earth Impact × 100.",
    )
    priority_band: PriorityBand
    formula_expression: str
    formula_numeric_trace: str
    dimension_separation_notice: str = Field(
        default=(
            "This Explainable Priority Score ranks operational investigation urgency by combining "
            "three separate dimensions (Orbital Screening Risk × Mission Criticality × Earth Impact). "
            "It is NOT a collision probability; mission importance never changes orbital physics."
        )
    )
    orbital_screening: OrbitalScreeningDimension
    mission_criticality: MissionCriticalityDimension
    earth_impact: EarthImpactDimension


class ServiceDisruptionItem(BaseModel):
    service_id: str
    service_name: str
    severity: SeverityTier
    dependent_sectors: list[str]
    potential_impact: str
    elevated_by_active_event: bool = False


class RedundancyGap(BaseModel):
    gap_type: str
    severity: SeverityTier
    summary: str
    mitigation_note: str


class AlternativeSatelliteRecommendation(BaseModel):
    norad_id: int
    name: str
    operator: str
    country: str
    mission_type: MissionType
    match_class: AlternativeMatchClass
    compatibility_score: float = Field(..., ge=0.0, le=1.0)
    sensor_overlap_score: float = Field(..., ge=0.0, le=1.0)
    service_overlap_score: float = Field(..., ge=0.0, le=1.0)
    coverage_overlap_score: float = Field(..., ge=0.0, le=1.0)
    matching_modalities: list[str]
    matching_services: list[str]
    overlapping_regions: list[str]
    resolution_comparison: str
    revisit_comparison: str
    data_access_model: str
    disaster_charter_eligible: bool
    gaps_and_limitations: list[str]
    replacement_caveat: str


class ContinuityAnalysisResponse(BaseModel):
    target_norad_id: int
    target_name: str
    is_catalogued_mission: bool = True
    disrupted_services: list[ServiceDisruptionItem]
    redundancy_gaps: list[RedundancyGap]
    alternatives: list[AlternativeSatelliteRecommendation]
    overall_continuity_assessment: str
    provenance: DataProvenance


class OperationalAdvisory(BaseModel):
    headline: str
    executive_summary: str
    orbital_screening_interpretation: str
    mission_and_earth_impact_brief: str
    continuity_and_backup_guidance: str
    recommended_operator_actions: list[str]
    scientific_caveats: list[str]
    generation_mode: Literal["llm_gemini", "llm_openai_compatible", "deterministic_fallback"]
    model_used: Optional[str] = None


class MissionProfileResponse(BaseModel):
    mission: SatelliteMission
    baseline_criticality: MissionCriticalityDimension
    baseline_earth_impact: EarthImpactDimension
    provenance: DataProvenance


class MissionListResponse(BaseModel):
    total: int
    satellites: list[SatelliteMission]
    provenance: DataProvenance


class ImpactAnalysisResponse(BaseModel):
    event_id: str
    target_norad_id: int
    target_name: str
    is_catalogued_mission: bool
    mission_profile: Optional[SatelliteMission] = None
    priority_assessment: ExplainablePriorityResult
    disrupted_services: list[ServiceDisruptionItem]
    redundancy_gaps: list[RedundancyGap]
    alternative_satellites: list[AlternativeSatelliteRecommendation]
    overall_continuity_assessment: str
    ai_advisory: Optional[OperationalAdvisory] = None
    provenance: DataProvenance
