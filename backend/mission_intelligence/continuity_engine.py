"""Earth-Level Service Disruption & Alternative Satellite Continuity Engine.

Evaluates:
1. Terrestrial services at risk of degradation or unavailability if a satellite is affected.
2. Concrete redundancy gaps (e.g., all-weather SAR gap, sovereign vs. external tasking,
   revisit cadence & spatial resolution degradation).
3. Candidate alternative satellites queried automatically from the mission database,
   strictly avoiding the fallacy that a similar mission is an automatic 1:1 replacement.
"""

from __future__ import annotations

from typing import Optional

from .database import MissionDatabase
from .schemas import (
    ActiveEarthEvent,
    AlternativeMatchClass,
    AlternativeSatelliteRecommendation,
    ContinuityAnalysisResponse,
    DataProvenance,
    RedundancyGap,
    SatelliteMission,
    SensorModality,
    ServiceDisruptionItem,
    SeverityTier,
)
from .scoring_engine import EVENT_SERVICE_MAP

# Symmetric compatibility matrix between sensor modalities (1.0 = exact same physical modality)
MODALITY_COMPATIBILITY: dict[tuple[SensorModality, SensorModality], float] = {
    (SensorModality.SAR_C_BAND, SensorModality.SAR_C_BAND): 1.00,
    (SensorModality.SAR_C_BAND, SensorModality.SAR_L_BAND): 0.78,
    (SensorModality.SAR_L_BAND, SensorModality.SAR_L_BAND): 1.00,
    (SensorModality.SAR_C_BAND, SensorModality.GNSS_R): 0.35,
    (SensorModality.SAR_C_BAND, SensorModality.OPTICAL_MULTISPECTRAL): 0.28,
    (SensorModality.SAR_L_BAND, SensorModality.OPTICAL_MULTISPECTRAL): 0.25,
    (SensorModality.OPTICAL_VHR, SensorModality.OPTICAL_VHR): 1.00,
    (SensorModality.OPTICAL_VHR, SensorModality.OPTICAL_MULTISPECTRAL): 0.55,
    (SensorModality.OPTICAL_MULTISPECTRAL, SensorModality.OPTICAL_MULTISPECTRAL): 1.00,
    (SensorModality.OPTICAL_MULTISPECTRAL, SensorModality.HYPERSPECTRAL): 0.65,
    (SensorModality.HYPERSPECTRAL, SensorModality.HYPERSPECTRAL): 1.00,
    (SensorModality.THERMAL_IR, SensorModality.THERMAL_IR): 1.00,
    (SensorModality.THERMAL_IR, SensorModality.GEO_IMAGER_SOUNDER): 0.45,
    (SensorModality.GEO_IMAGER_SOUNDER, SensorModality.GEO_IMAGER_SOUNDER): 1.00,
    (SensorModality.SCATTEROMETER, SensorModality.SCATTEROMETER): 1.00,
    (SensorModality.SCATTEROMETER, SensorModality.GNSS_R): 0.45,
    (SensorModality.OCEAN_COLOR, SensorModality.OCEAN_COLOR): 1.00,
    (SensorModality.OCEAN_COLOR, SensorModality.OPTICAL_MULTISPECTRAL): 0.40,
    (SensorModality.COMMS_TRANSPONDER, SensorModality.COMMS_TRANSPONDER): 1.00,
    (SensorModality.PNT_NAVIGATION, SensorModality.PNT_NAVIGATION): 1.00,
    (SensorModality.SEARCH_AND_RESCUE, SensorModality.SEARCH_AND_RESCUE): 1.00,
}

SAR_MODALITIES = {SensorModality.SAR_C_BAND, SensorModality.SAR_L_BAND}


def _modality_similarity(a: SensorModality, b: SensorModality) -> float:
    if a == b:
        return 1.0
    return MODALITY_COMPATIBILITY.get((a, b), MODALITY_COMPATIBILITY.get((b, a), 0.0))


def _best_resolution_m(mission: SatelliteMission) -> Optional[float]:
    resolutions = [s.spatial_resolution_m for s in mission.sensors if s.spatial_resolution_m is not None]
    return min(resolutions) if resolutions else None


def _compare_resolutions(target: SatelliteMission, candidate: SatelliteMission) -> tuple[str, Optional[str]]:
    t_res = _best_resolution_m(target)
    c_res = _best_resolution_m(candidate)
    if t_res is None or c_res is None:
        return (
            "Spatial resolution comparison unavailable (one or both sensors lack comparable public GSD figures).",
            None,
        )
    if c_res <= t_res * 1.15:
        return (
            f"Comparable or finer public nominal resolution (candidate ~{c_res:g} m vs. target ~{t_res:g} m; mode-dependent).",
            None,
        )
    ratio = c_res / t_res if t_res > 0 else 1.0
    gap = (
        f"Coarser best nominal resolution than {target.name} "
        f"(candidate ~{c_res:g} m vs. target ~{t_res:g} m, ~{ratio:.1f}x coarser in finest mode)."
    )
    return (gap, gap)


def _compare_revisit(target: SatelliteMission, candidate: SatelliteMission) -> tuple[str, Optional[str]]:
    t_rev = target.revisit_time_days
    c_rev = candidate.revisit_time_days
    if t_rev is None or c_rev is None:
        return (
            "Nominal revisit comparison incomplete (public revisit interval unverified for one mission).",
            "Revisit cadence over target area cannot be guaranteed from public metadata alone.",
        )
    if target.orbit_regime.value == "GEO" and candidate.orbit_regime.value != "GEO":
        gap = (
            f"Orbit regime mismatch: {target.name} provides continuous geostationary viewing "
            f"(~{t_rev:g} day refresh), whereas {candidate.name} is polar/LEO (~{c_rev:g} day revisit)."
        )
        return (gap, gap)
    if c_rev <= t_rev * 1.15:
        return (
            f"Comparable or faster nominal repeat cycle (candidate ~{c_rev:g} days vs. target ~{t_rev:g} days; pass timing still differs).",
            None,
        )
    gap = (
        f"Longer nominal repeat cycle than {target.name} "
        f"(candidate ~{c_rev:g} days vs. target ~{t_rev:g} days)."
    )
    return (gap, gap)


def analyze_service_disruptions(
    mission: Optional[SatelliteMission],
    active_earth_events: Optional[list[ActiveEarthEvent]] = None,
) -> list[ServiceDisruptionItem]:
    """Identify Earth-level services vulnerable to degradation or unavailability."""
    if mission is None:
        return []

    elevated_service_ids: set[str] = set()
    for ev in active_earth_events or []:
        elevated_service_ids.update(EVENT_SERVICE_MAP.get(ev.event_type, set()))

    disruptions: list[ServiceDisruptionItem] = []
    for dep in mission.active_service_dependencies:
        is_elevated = dep.service_id in elevated_service_ids
        severity = dep.criticality_tier
        if is_elevated and severity == SeverityTier.HIGH:
            severity = SeverityTier.CRITICAL
        elif is_elevated and severity == SeverityTier.MODERATE:
            severity = SeverityTier.HIGH

        disruptions.append(
            ServiceDisruptionItem(
                service_id=dep.service_id,
                service_name=dep.service_name,
                severity=severity,
                dependent_sectors=dep.dependent_sectors,
                potential_impact=dep.disruption_consequence,
                elevated_by_active_event=is_elevated,
            )
        )

    severity_rank = {
        SeverityTier.CRITICAL: 0,
        SeverityTier.HIGH: 1,
        SeverityTier.MODERATE: 2,
        SeverityTier.LOW: 3,
    }
    return sorted(disruptions, key=lambda d: (severity_rank[d.severity], not d.elevated_by_active_event))


def find_alternative_satellites(
    target: SatelliteMission,
    db: MissionDatabase,
    *,
    max_results: int = 5,
) -> list[AlternativeSatelliteRecommendation]:
    """Query mission database for overlapping backup satellites with explicit gap analysis."""
    target_modalities = [s.modality for s in target.sensors]
    target_services = {dep.service_id for dep in target.active_service_dependencies}
    target_regions = {r.lower() for r in target.coverage_regions}
    target_all_weather = any(s.all_weather_capable for s in target.sensors)

    recommendations: list[AlternativeSatelliteRecommendation] = []

    for candidate in db.list_all():
        if candidate.norad_id == target.norad_id:
            continue

        cand_modalities = [s.modality for s in candidate.sensors]
        cand_services = {dep.service_id for dep in candidate.active_service_dependencies}
        cand_regions = {r.lower() for r in candidate.coverage_regions}

        # 1. Sensor modality overlap (average best match for each target sensor)
        sensor_scores: list[float] = []
        matching_modalities: set[str] = set()
        for t_mod in target_modalities:
            best_for_t = 0.0
            for c_mod in cand_modalities:
                sim = _modality_similarity(t_mod, c_mod)
                if sim > best_for_t:
                    best_for_t = sim
                if sim >= 0.40:
                    matching_modalities.add(c_mod.value)
            sensor_scores.append(best_for_t)
        sensor_overlap = round(sum(sensor_scores) / len(sensor_scores), 3) if sensor_scores else 0.0

        # 2. Service dependency overlap
        shared_services = sorted(target_services.intersection(cand_services))
        service_overlap = (
            round(len(shared_services) / len(target_services), 3) if target_services else 0.0
        )

        # Skip completely unrelated satellites (e.g., navigation sat as backup for SAR flood sat)
        if sensor_overlap < 0.25 and service_overlap == 0.0:
            continue
        if sensor_overlap < 0.20:
            continue

        # 3. Geographic coverage overlap
        if "global" in cand_regions:
            overlapping_regions = list(target.coverage_regions)
            coverage_overlap = 0.90 if "global" not in target_regions else 1.0
        else:
            common = sorted(
                r for r in target.coverage_regions if r.lower() in cand_regions
            )
            overlapping_regions = common
            coverage_overlap = (
                round(len(common) / max(1, len(target_regions - {"global"})), 3)
                if common
                else 0.0
            )

        if coverage_overlap == 0.0:
            continue

        # 4. Composite compatibility score (weighted toward physical sensor capability)
        is_peer = candidate.norad_id in target.constellation_peers
        same_country = candidate.country.lower() == target.country.lower()
        peer_bonus = 0.08 if is_peer else (0.04 if same_country else 0.0)
        compatibility = round(
            min(
                0.98,  # Never 1.00 — orbital phasing/pass timing always differs
                0.50 * sensor_overlap
                + 0.30 * service_overlap
                + 0.20 * coverage_overlap
                + peer_bonus,
            ),
            3,
        )

        # Collect concrete gaps & limitations (Scientific Rule: similar != full replacement)
        gaps: list[str] = []
        cand_all_weather = any(s.all_weather_capable for s in candidate.sensors)

        if target_all_weather and not cand_all_weather:
            gaps.append(
                "CRITICAL ALL-WEATHER GAP: Candidate relies on optical/IR sensing and cannot penetrate "
                "dense monsoon or cyclone cloud cover like radar (SAR)."
            )

        if any(m == SensorModality.SAR_C_BAND for m in target_modalities) and any(
            m == SensorModality.SAR_L_BAND for m in cand_modalities
        ):
            gaps.append(
                "Radar frequency difference (L-band vs. C-band): backscatter calibration and existing "
                "C-band flood-extraction pipelines require adaptation."
            )

        if any(m == SensorModality.SEARCH_AND_RESCUE for m in target_modalities) and not any(
            m == SensorModality.SEARCH_AND_RESCUE for m in cand_modalities
        ):
            gaps.append(
                "Does not carry domestic Satellite-Aided Search & Rescue (SAS&R) or Data Relay Transponders."
            )

        res_comparison, res_gap = _compare_resolutions(target, candidate)
        if res_gap:
            gaps.append(res_gap)

        rev_comparison, rev_gap = _compare_revisit(target, candidate)
        if rev_gap:
            gaps.append(rev_gap)

        if not same_country:
            if "Open Public" in candidate.data_access_model:
                gaps.append(
                    f"External operator ({candidate.operator}); open public archive avoids licensing delays, "
                    "but acquisition schedules cannot be domestically tasked."
                )
            else:
                gaps.append(
                    f"External operator ({candidate.operator}, {candidate.data_access_model}); "
                    "requires International Disaster Charter activation or commercial tasking agreements."
                )

        if is_peer:
            gaps.append(
                "Same-constellation peer shares sensor architecture, but orbital slot/pass timing differs "
                "and losing one spacecraft still reduces overall constellation revisit cadence."
            )

        if is_peer and sensor_overlap >= 0.85:
            match_class = AlternativeMatchClass.SAME_CONSTELLATION_PEER
        elif compatibility >= 0.72 and (not target_all_weather or cand_all_weather):
            match_class = AlternativeMatchClass.STRONG_PARTIAL_ALTERNATIVE
        elif compatibility >= 0.45:
            match_class = AlternativeMatchClass.PARTIAL_CAPABILITY_MATCH
        else:
            match_class = AlternativeMatchClass.COMPLEMENTARY_SUPPORT_ONLY

        recommendations.append(
            AlternativeSatelliteRecommendation(
                norad_id=candidate.norad_id,
                name=candidate.name,
                operator=candidate.operator,
                country=candidate.country,
                mission_type=candidate.mission_type,
                match_class=match_class,
                compatibility_score=compatibility,
                sensor_overlap_score=sensor_overlap,
                service_overlap_score=service_overlap,
                coverage_overlap_score=coverage_overlap,
                matching_modalities=sorted(matching_modalities),
                matching_services=shared_services,
                overlapping_regions=overlapping_regions,
                resolution_comparison=res_comparison,
                revisit_comparison=rev_comparison,
                data_access_model=candidate.data_access_model,
                disaster_charter_eligible=candidate.disaster_charter_eligible,
                gaps_and_limitations=gaps,
                replacement_caveat=(
                    f"{candidate.name} provides overlapping capabilities ({match_class.value}), "
                    "but is not an automatic 1:1 replacement due to orbital pass timing, sensor mode, "
                    "and operational control differences."
                ),
            )
        )

    recommendations.sort(key=lambda r: (r.compatibility_score, r.sensor_overlap_score), reverse=True)
    return recommendations[:max_results]


def identify_redundancy_gaps(
    target: SatelliteMission,
    alternatives: list[AlternativeSatelliteRecommendation],
    active_earth_events: Optional[list[ActiveEarthEvent]] = None,
) -> list[RedundancyGap]:
    """Detect systemic redundancy weaknesses across available candidate backups."""
    gaps: list[RedundancyGap] = []

    domestic_strong = [
        alt
        for alt in alternatives
        if alt.country.lower() == target.country.lower() and alt.compatibility_score >= 0.65
    ]
    if not domestic_strong:
        gaps.append(
            RedundancyGap(
                gap_type="SOVEREIGN_DOMESTIC_REDUNDANCY_GAP",
                severity=SeverityTier.HIGH,
                summary=(
                    f"No direct domestic ({target.country}) satellite with equivalent primary sensor "
                    f"capability is available in the catalog to back up {target.name}."
                ),
                mitigation_note=(
                    "Coordinate pre-authorized open international feeds (e.g., Copernicus / WMO) or "
                    "International Charter Space and Major Disasters tasking pathways."
                ),
            )
        )

    target_is_sar = any(s.modality in SAR_MODALITIES for s in target.sensors)
    sar_alts = [
        alt
        for alt in alternatives
        if any(m in {"SAR_C_BAND", "SAR_L_BAND"} for m in alt.matching_modalities)
    ]
    if target_is_sar and not sar_alts:
        gaps.append(
            RedundancyGap(
                gap_type="ALL_WEATHER_SAR_CONTINUITY_GAP",
                severity=SeverityTier.CRITICAL,
                summary=(
                    f"No all-weather SAR backup identified for {target.name}; optical backups cannot "
                    "penetrate monsoon or cyclonic cloud cover."
                ),
                mitigation_note="Escalate orbital review and establish external commercial/agency SAR tasking.",
            )
        )
    elif target_is_sar and not any(a.country.lower() == target.country.lower() for a in sar_alts):
        gaps.append(
            RedundancyGap(
                gap_type="SOVEREIGN_ALL_WEATHER_SAR_GAP",
                severity=SeverityTier.HIGH,
                summary=(
                    f"All-weather radar (SAR) continuity for {target.name} relies exclusively on "
                    f"international missions ({', '.join(a.name for a in sar_alts[:3])}) with fixed external pass schedules."
                ),
                mitigation_note=(
                    "Pre-stage Sentinel-1A/1C Copernicus ingestion pipelines and Sentinel Asia / "
                    "International Charter tasking for ALOS-2 or RCM-1 during monsoon flood windows."
                ),
            )
        )

    if any(s.modality == SensorModality.SEARCH_AND_RESCUE for s in target.sensors):
        sar_beacon_alts = [
            a for a in alternatives if SensorModality.SEARCH_AND_RESCUE.value in a.matching_modalities
        ]
        if len(sar_beacon_alts) <= 1:
            gaps.append(
                RedundancyGap(
                    gap_type="EMERGENCY_BEACON_RELAY_CONCENTRATION",
                    severity=SeverityTier.HIGH,
                    summary=(
                        f"Geostationary distress-beacon relay (SAS&R) depends heavily on {target.name} "
                        "and limited co-regional INSAT assets."
                    ),
                    mitigation_note="Verify MEOSAR/LEOSAR COSPAS-SARSAT fallback routing with INMCC.",
                )
            )

    if active_earth_events:
        active_desc = ", ".join(f"{e.event_type} ({e.region})" for e in active_earth_events)
        gaps.append(
            RedundancyGap(
                gap_type="ACTIVE_DISASTER_REVISIT_SENSITIVITY",
                severity=SeverityTier.HIGH,
                summary=(
                    f"Active Earth emergency context ({active_desc}) reduces tolerance for any "
                    "acquisition outage or maneuver-induced observation blackout."
                ),
                mitigation_note=(
                    "Coordinate potential collision-avoidance maneuver windows (if validated by CDM) "
                    "with disaster-management pass schedules to minimize critical observation loss."
                ),
            )
        )

    if not alternatives:
        gaps.append(
            RedundancyGap(
                gap_type="SINGLE_POINT_OF_FAILURE",
                severity=SeverityTier.CRITICAL,
                summary=f"No compatible backup satellites found in catalog for {target.name}.",
                mitigation_note="Prioritize validated CDM assessment and contingency planning.",
            )
        )

    return gaps


def run_continuity_analysis(
    norad_id: int,
    db: MissionDatabase,
    *,
    active_earth_events: Optional[list[ActiveEarthEvent]] = None,
    max_results: int = 5,
    conjunction_provenance: str = "simulated_scenario",
    target_name_fallback: Optional[str] = None,
) -> ContinuityAnalysisResponse:
    """Execute full Earth-level service disruption & alternative satellite continuity analysis."""
    mission = db.get_by_norad_id(norad_id)
    if mission is None:
        return ContinuityAnalysisResponse(
            target_norad_id=norad_id,
            target_name=target_name_fallback or f"NORAD {norad_id}",
            is_catalogued_mission=False,
            disrupted_services=[],
            redundancy_gaps=[
                RedundancyGap(
                    gap_type="UNCATALOGUED_MISSION_METADATA",
                    severity=SeverityTier.MODERATE,
                    summary=(
                        f"NORAD ID {norad_id} is not present in ASTRAVIGIL's verified mission catalog. "
                        "Earth service dependencies and alternative matches cannot be inferred without verified metadata."
                    ),
                    mitigation_note="Add verified operator/sensor profile to mission_db.json.",
                )
            ],
            alternatives=[],
            overall_continuity_assessment=(
                "Mission metadata unavailable in curated catalog; continuity assessment requires "
                "verified payload and service-dependency inputs."
            ),
            provenance=DataProvenance(
                mission_data_provenance="uncatalogued_fallback",
                conjunction_data_provenance=conjunction_provenance,  # type: ignore[arg-type]
            ),
        )

    disruptions = analyze_service_disruptions(mission, active_earth_events)
    alternatives = find_alternative_satellites(mission, db, max_results=max_results)
    gaps = identify_redundancy_gaps(mission, alternatives, active_earth_events)

    top_names = ", ".join(
        f"{a.name} ({int(a.compatibility_score * 100)}% overlap, {a.match_class.value})"
        for a in alternatives[:3]
    )
    if alternatives:
        overall = (
            f"If {mission.name} experiences service degradation or unavailability, "
            f"{len(disruptions)} documented terrestrial service(s) could be impacted. "
            f"Top partial continuity candidates: {top_names}. "
            f"{len(gaps)} redundancy gap(s) identified; no external mission provides an automatic 1:1 replacement."
        )
    else:
        overall = (
            f"No overlapping backup satellites were identified in the current catalog for {mission.name}; "
            "service continuity risk is elevated if the spacecraft becomes unavailable."
        )

    return ContinuityAnalysisResponse(
        target_norad_id=mission.norad_id,
        target_name=mission.name,
        is_catalogued_mission=True,
        disrupted_services=disruptions,
        redundancy_gaps=gaps,
        alternatives=alternatives,
        overall_continuity_assessment=overall,
        provenance=DataProvenance(
            mission_data_provenance="verified_public_catalog",
            conjunction_data_provenance=conjunction_provenance,  # type: ignore[arg-type]
        ),
    )
