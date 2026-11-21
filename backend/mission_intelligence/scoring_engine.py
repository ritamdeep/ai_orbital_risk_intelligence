"""Mission Criticality & Earth Impact Explainable Scoring Engine.

Implements ASTRAVIGIL's transparent operational triage formula:
    Explainable Priority Score = (Orbital Screening Risk × Mission Criticality × Effective Earth Impact) × 100

Scientific guardrails enforced:
- Orbital Screening Risk, Mission Criticality, and Earth Impact are computed and
  reported as separate, independent dimensions.
- Mission Criticality and Earth Impact NEVER alter physical collision probability.
- Physical collision probability (Pc) is never invented from public TLEs.
"""

from __future__ import annotations

import math
from typing import Optional

from .schemas import (
    ActiveEarthEvent,
    ConjunctionAlertInput,
    ContextMultiplierApplied,
    EarthImpactDimension,
    ExplainablePriorityResult,
    MissionCriticalityDimension,
    OrbitalScreeningDimension,
    PriorityBand,
    SatelliteMission,
    ScreeningTier,
    SensorModality,
    SeverityTier,
    WeightedCriterion,
)

# Deterministic weights for Mission Criticality (sum = 1.00)
CRITICALITY_WEIGHTS: dict[str, float] = {
    "disaster_response_reliance": 0.35,
    "service_dependency_breadth": 0.25,
    "domestic_redundancy_scarcity": 0.25,
    "sensor_uniqueness": 0.15,
}

# Base Earth Impact score by service criticality tier
SERVICE_TIER_BASE_SCORES: dict[SeverityTier, float] = {
    SeverityTier.CRITICAL: 0.85,
    SeverityTier.HIGH: 0.68,
    SeverityTier.MODERATE: 0.45,
    SeverityTier.LOW: 0.20,
}

# Event-to-service relevance mapping for dynamic Earth-impact context multipliers
EVENT_SERVICE_MAP: dict[str, set[str]] = {
    "flood_alert": {"flood_monitoring", "disaster_damage_mapping", "emergency_comms"},
    "cyclone_alert": {
        "cyclone_tracking",
        "weather_forecasting",
        "flood_monitoring",
        "search_and_rescue",
        "emergency_comms",
        "maritime_safety",
    },
    "earthquake_alert": {"disaster_damage_mapping", "emergency_comms", "navigation_pnt"},
    "landslide_alert": {"disaster_damage_mapping", "flood_monitoring"},
    "wildfire_alert": {"wildfire_thermal_monitoring", "disaster_damage_mapping"},
    "drought_alert": {"agriculture_crop_monitoring"},
    "telecom_outage": {"emergency_comms", "navigation_pnt"},
    "maritime_emergency": {"search_and_rescue", "maritime_safety", "navigation_pnt"},
}

SEVERITY_MULTIPLIER_BOOST: dict[SeverityTier, float] = {
    SeverityTier.CRITICAL: 0.40,
    SeverityTier.HIGH: 0.30,
    SeverityTier.MODERATE: 0.18,
    SeverityTier.LOW: 0.08,
}

# Sub-region aliases to match Indian / regional disaster alerts to satellite coverage regions
REGION_ALIASES: dict[str, set[str]] = {
    "india": {
        "india",
        "assam",
        "brahmaputra",
        "bihar",
        "kerala",
        "odisha",
        "west bengal",
        "gujarat",
        "maharashtra",
        "uttarakhand",
        "himachal",
        "tamil nadu",
        "andhra",
        "mumbai",
        "chennai",
        "kolkata",
        "himalaya",
        "ganga",
        "south asia",
    },
    "bay of bengal": {"bay of bengal", "odisha", "west bengal", "andhra", "tamil nadu", "andaman", "indian ocean"},
    "arabian sea": {"arabian sea", "gujarat", "maharashtra", "kerala", "konkan", "mumbai", "indian ocean"},
    "indian ocean": {"indian ocean", "bay of bengal", "arabian sea", "andaman", "lakshadweep"},
}


def _score_to_severity_tier(score: float) -> SeverityTier:
    if score >= 0.80:
        return SeverityTier.CRITICAL
    if score >= 0.60:
        return SeverityTier.HIGH
    if score >= 0.35:
        return SeverityTier.MODERATE
    return SeverityTier.LOW


def _region_matches(alert_region: str, coverage_regions: list[str]) -> bool:
    alert_norm = alert_region.strip().lower()
    cov_norms = [c.strip().lower() for c in coverage_regions]

    if "global" in cov_norms:
        return True

    for cov in cov_norms:
        if cov in alert_norm or alert_norm in cov:
            return True
        aliases = REGION_ALIASES.get(cov, set())
        if any(alias in alert_norm for alias in aliases):
            return True
    return False


def compute_orbital_screening_dimension(alert: ConjunctionAlertInput) -> OrbitalScreeningDimension:
    """Normalize Member 2's physical screening metrics without fabricating collision probability."""
    if alert.orbital_risk_score is not None:
        orbital_score = round(float(alert.orbital_risk_score), 4)
        derivation = (
            f"Provided directly by Orbital Risk Engine (normalized screening score={orbital_score:.2f} "
            f"for miss_distance={alert.miss_distance_km:.2f} km, rel_vel={alert.relative_velocity_kms:.2f} km/s)."
        )
    else:
        # Smooth, monotonic distance screening component (80% weight) + closure speed factor (20% weight)
        # 0.5 km -> ~0.95, 2.0 km -> ~0.82, 5.0 km -> ~0.61, 10.0 km -> ~0.37, 25.0 km -> ~0.08
        dist_component = math.exp(-alert.miss_distance_km / 10.0)
        vel_component = min(1.0, alert.relative_velocity_kms / 15.0)
        orbital_score = round(min(1.0, max(0.01, 0.80 * dist_component + 0.20 * vel_component)), 4)
        derivation = (
            f"Derived from preliminary SGP4 geometry: 0.80 × exp(-{alert.miss_distance_km:.2f}/10.0) "
            f"[{dist_component:.3f}] + 0.20 × min(1, {alert.relative_velocity_kms:.2f}/15.0) "
            f"[{vel_component:.3f}] = {orbital_score:.4f}."
        )

    if alert.miss_distance_km <= 1.5 or orbital_score >= 0.85:
        tier = ScreeningTier.IMMEDIATE_CDM_REVIEW
    elif alert.miss_distance_km <= 5.0 or orbital_score >= 0.60:
        tier = ScreeningTier.ELEVATED_REVIEW
    elif alert.miss_distance_km <= 15.0 or orbital_score >= 0.30:
        tier = ScreeningTier.ENHANCED_MONITORING
    else:
        tier = ScreeningTier.ROUTINE_SCREENING

    if alert.tle_epoch_age_hours is None:
        freshness_note = (
            "TLE epoch age not supplied; verify ephemeris freshness before operational maneuver decisions."
        )
    elif alert.tle_epoch_age_hours > 72.0:
        freshness_note = (
            f"WARNING: TLE epoch age is {alert.tle_epoch_age_hours:.1f} hours (>72h). "
            "SGP4 position uncertainty degrades substantially over multi-day propagation."
        )
    elif alert.tle_epoch_age_hours > 24.0:
        freshness_note = (
            f"Moderate TLE epoch age ({alert.tle_epoch_age_hours:.1f} hours). "
            "Re-screen after next public GP/TLE update."
        )
    else:
        freshness_note = f"Recent TLE epoch ({alert.tle_epoch_age_hours:.1f} hours old)."

    physical_note = (
        f"Preliminary screening against catalogued {alert.secondary_object_type.lower()} "
        f"({alert.secondary_name}) indicates a closest-approach distance of {alert.miss_distance_km:.2f} km "
        f"at {alert.relative_velocity_kms:.2f} km/s relative speed. A close approach does not automatically "
        "imply collision; validated Conjunction Data Messages (CDMs) with state-vector covariance are "
        "required to compute physical collision probability (Pc)."
    )

    return OrbitalScreeningDimension(
        orbital_risk_score=orbital_score,
        screening_tier=tier,
        miss_distance_km=alert.miss_distance_km,
        relative_velocity_kms=alert.relative_velocity_kms,
        tca_utc=alert.tca_utc,
        tle_epoch_age_hours=alert.tle_epoch_age_hours,
        tle_freshness_note=freshness_note,
        collision_probability=None,
        physical_assessment_note=physical_note,
        score_derivation=derivation,
    )


def compute_mission_criticality(
    mission: Optional[SatelliteMission],
) -> MissionCriticalityDimension:
    """Compute deterministic, explainable Mission Criticality independently of orbital risk."""
    if mission is None:
        return MissionCriticalityDimension(
            mission_criticality_score=0.50,
            criticality_tier=SeverityTier.MODERATE,
            formula="Uncatalogued mission baseline = 0.50 (pending operator mission-profile verification)",
            criteria_breakdown=[
                WeightedCriterion(
                    criterion="Uncatalogued Satellite Baseline",
                    weight=1.0,
                    raw_score=0.50,
                    weighted_contribution=0.50,
                    rationale=(
                        "NORAD ID is not yet in ASTRAVIGIL's verified mission database. "
                        "A neutral 0.50 baseline is applied rather than inventing mission specifications."
                    ),
                )
            ],
            is_catalogued_mission=False,
        )

    factors = mission.mission_criticality_factors
    sensor_names = ", ".join(s.name for s in mission.sensors)
    service_names = ", ".join(d.service_name for d in mission.active_service_dependencies)
    peer_note = (
        f"{len(mission.constellation_peers)} direct constellation peer(s) tracked."
        if mission.constellation_peers
        else "No direct same-constellation domestic peer tracked in catalog."
    )

    raw_items = [
        (
            "Disaster Response Reliance",
            CRITICALITY_WEIGHTS["disaster_response_reliance"],
            factors.disaster_response_reliance,
            f"Reflects operational reliance by emergency/disaster workflows ({service_names}).",
        ),
        (
            "Service Dependency Breadth",
            CRITICALITY_WEIGHTS["service_dependency_breadth"],
            factors.service_dependency_breadth,
            f"Supports {len(mission.active_service_dependencies)} documented active terrestrial service(s) "
            f"across {', '.join(mission.coverage_regions[:3])}.",
        ),
        (
            "Domestic Redundancy Scarcity",
            CRITICALITY_WEIGHTS["domestic_redundancy_scarcity"],
            factors.domestic_redundancy_scarcity,
            peer_note,
        ),
        (
            "Sensor & Payload Uniqueness",
            CRITICALITY_WEIGHTS["sensor_uniqueness"],
            factors.sensor_uniqueness,
            f"Payload suite: {sensor_names}.",
        ),
    ]

    breakdown: list[WeightedCriterion] = []
    total = 0.0
    for label, weight, raw_val, rationale in raw_items:
        contrib = round(weight * raw_val, 4)
        total += contrib
        breakdown.append(
            WeightedCriterion(
                criterion=label,
                weight=weight,
                raw_score=round(raw_val, 4),
                weighted_contribution=contrib,
                rationale=rationale,
            )
        )

    total = round(min(1.0, max(0.0, total)), 4)
    return MissionCriticalityDimension(
        mission_criticality_score=total,
        criticality_tier=_score_to_severity_tier(total),
        formula=(
            "0.35 × Disaster Response Reliance + 0.25 × Service Dependency Breadth "
            "+ 0.25 × Domestic Redundancy Scarcity + 0.15 × Sensor Uniqueness"
        ),
        criteria_breakdown=breakdown,
        is_catalogued_mission=True,
    )


def compute_earth_impact(
    mission: Optional[SatelliteMission],
    active_earth_events: Optional[list[ActiveEarthEvent]] = None,
) -> EarthImpactDimension:
    """Compute Earth-level service impact with transparent dynamic context multipliers."""
    events = active_earth_events or []

    if mission is None:
        return EarthImpactDimension(
            base_earth_impact_score=0.50,
            dynamic_context_multiplier=1.0,
            effective_earth_impact_score=0.50,
            uncapped_earth_impact_score=0.50,
            earth_impact_tier=SeverityTier.MODERATE,
            applied_multipliers=[],
            service_weights_summary=[
                {
                    "service_id": "unknown",
                    "service_name": "Unverified Mission Services",
                    "criticality_tier": "MODERATE",
                    "base_score": 0.50,
                }
            ],
        )

    service_scores: list[float] = []
    service_summary: list[dict[str, object]] = []
    for dep in mission.active_service_dependencies:
        tier_score = SERVICE_TIER_BASE_SCORES[dep.criticality_tier]
        service_scores.append(tier_score)
        service_summary.append(
            {
                "service_id": dep.service_id,
                "service_name": dep.service_name,
                "criticality_tier": dep.criticality_tier.value,
                "base_score": tier_score,
                "dependent_sectors": dep.dependent_sectors,
            }
        )

    if service_scores:
        highest = max(service_scores)
        # Small breadth increment for multi-service missions, capped at 0.92 before dynamic alerts
        breadth_bonus = min(0.08, 0.04 * (len(service_scores) - 1))
        base_score = round(min(0.92, highest + breadth_bonus), 4)
    else:
        base_score = 0.20

    mission_service_ids = {dep.service_id for dep in mission.active_service_dependencies}
    has_all_weather_sar = any(
        s.modality in {SensorModality.SAR_C_BAND, SensorModality.SAR_L_BAND}
        and s.all_weather_capable
        for s in mission.sensors
    )

    applied: list[ContextMultiplierApplied] = []
    cumulative_multiplier = 1.0

    for event in events:
        relevant_services = EVENT_SERVICE_MAP.get(event.event_type, set())
        matched = sorted(mission_service_ids.intersection(relevant_services))
        if not matched:
            continue

        region_hit = _region_matches(event.region, mission.coverage_regions)
        boost = SEVERITY_MULTIPLIER_BOOST[event.severity]
        if not region_hit:
            boost *= 0.5

        all_weather_note = ""
        if event.event_type in {"flood_alert", "cyclone_alert"} and has_all_weather_sar:
            boost += 0.10
            all_weather_note = " Includes +0.10 all-weather SAR cloud-penetration criticality boost."

        event_multiplier = round(1.0 + boost, 3)
        cumulative_multiplier *= event_multiplier

        rationale = (
            f"Active {event.severity.value} {event.event_type.replace('_', ' ')} in {event.region} "
            f"directly elevates demand on {', '.join(matched)}."
            + (" Coverage region confirmed." if region_hit else " Outside primary regional focus (attenuated boost).")
            + all_weather_note
        )
        applied.append(
            ContextMultiplierApplied(
                event_type=event.event_type,
                region=event.region,
                severity=event.severity,
                matched_services=matched,
                region_matched=region_hit,
                multiplier=event_multiplier,
                rationale=rationale,
            )
        )

    cumulative_multiplier = round(min(1.60, cumulative_multiplier), 3)
    uncapped = round(base_score * cumulative_multiplier, 4)
    effective = round(min(1.0, uncapped), 4)

    return EarthImpactDimension(
        base_earth_impact_score=base_score,
        dynamic_context_multiplier=cumulative_multiplier,
        effective_earth_impact_score=effective,
        uncapped_earth_impact_score=uncapped,
        earth_impact_tier=_score_to_severity_tier(effective),
        applied_multipliers=applied,
        service_weights_summary=service_summary,
    )


def compute_explainable_priority(
    alert: ConjunctionAlertInput,
    mission: Optional[SatelliteMission],
) -> ExplainablePriorityResult:
    """Compute the combined Explainable Priority Score across all three separate dimensions."""
    orbital_dim = compute_orbital_screening_dimension(alert)
    criticality_dim = compute_mission_criticality(mission)
    earth_dim = compute_earth_impact(mission, alert.active_earth_events)

    priority_score = round(
        min(
            100.0,
            orbital_dim.orbital_risk_score
            * criticality_dim.mission_criticality_score
            * earth_dim.effective_earth_impact_score
            * 100.0,
        ),
        2,
    )

    if priority_score >= 60.0:
        band = PriorityBand.CRITICAL_PRIORITY
    elif priority_score >= 35.0:
        band = PriorityBand.HIGH_PRIORITY
    elif priority_score >= 15.0:
        band = PriorityBand.ELEVATED_MONITORING
    else:
        band = PriorityBand.ROUTINE_WATCH

    earth_detail = (
        f"{earth_dim.effective_earth_impact_score:.2f} "
        f"[base {earth_dim.base_earth_impact_score:.2f} × {earth_dim.dynamic_context_multiplier:.2f}x context"
        + (", capped at 1.00]" if earth_dim.uncapped_earth_impact_score > 1.0 else "]")
        if earth_dim.applied_multipliers
        else f"{earth_dim.effective_earth_impact_score:.2f} [baseline, no active disaster alerts]"
    )

    numeric_trace = (
        f"Orbital Screening Risk ({orbital_dim.orbital_risk_score:.2f}) "
        f"× Mission Criticality ({criticality_dim.mission_criticality_score:.2f}) "
        f"× Earth Impact ({earth_detail}) × 100 = {priority_score:.2f} / 100 [{band.value}]"
    )

    return ExplainablePriorityResult(
        explainable_priority_score=priority_score,
        priority_band=band,
        formula_expression="Explainable Priority Score = Orbital Screening Risk × Mission Criticality × Effective Earth Impact × 100",
        formula_numeric_trace=numeric_trace,
        orbital_screening=orbital_dim,
        mission_criticality=criticality_dim,
        earth_impact=earth_dim,
    )
