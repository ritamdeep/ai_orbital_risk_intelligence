"""Alternative Satellite Finder & Redundancy Gap Analysis Engine.

Compares satellites within similar mission categories (and complementary Earth-service
capabilities) across five explicit dimensions:
1. sensorType         (max 35 pts)
2. spatialResolution  (max 20 pts)
3. revisitTime        (max 15 pts)
4. coverage           (max 15 pts)
5. dataAccess         (max 15 pts)

capabilityMatch (0-100) is capped at 95 because no external or peer spacecraft is an
automatic one-to-one operational replacement (orbital phasing, tasking, and calibration
always differ). Always returns explicit limitations, plain-word redundancyGaps, and
the canonical contract caveat.
"""

from __future__ import annotations

from typing import Optional

from .config import ALTERNATIVE_CAVEAT_TEXT, ALTERNATIVE_MATCH_WEIGHTS
from .database import MissionDatabase
from .schemas import (
    AlternativeCandidate,
    AlternativesResponse,
    FieldComparisonItem,
    SatelliteRecord,
)

# Sensor-family compatibility fraction (0.0 .. 1.0)
SENSOR_FAMILY_COMPATIBILITY: dict[tuple[str, str], float] = {
    ("SAR_C_BAND", "SAR_C_BAND"): 1.00,
    ("SAR_C_BAND", "SAR_L_BAND"): 0.78,
    ("SAR_L_BAND", "SAR_L_BAND"): 1.00,
    ("SAR_C_BAND", "OPTICAL_MULTISPECTRAL"): 0.25,
    ("SAR_C_BAND", "OPTICAL_VHR"): 0.25,
    ("OPTICAL_VHR", "OPTICAL_VHR"): 1.00,
    ("OPTICAL_VHR", "OPTICAL_MULTISPECTRAL"): 0.65,
    ("OPTICAL_VHR", "HYPERSPECTRAL"): 0.55,
    ("OPTICAL_MULTISPECTRAL", "OPTICAL_MULTISPECTRAL"): 1.00,
    ("OPTICAL_MULTISPECTRAL", "HYPERSPECTRAL"): 0.75,
    ("HYPERSPECTRAL", "HYPERSPECTRAL"): 1.00,
    ("OCEAN_MULTI_SENSOR", "OCEAN_MULTI_SENSOR"): 1.00,
    ("OCEAN_MULTI_SENSOR", "POLAR_MET_SOUNDER"): 0.65,
    ("OCEAN_MULTI_SENSOR", "OPTICAL_MULTISPECTRAL"): 0.40,
    ("GEO_MET_IMAGER_SOUNDER", "GEO_MET_IMAGER_SOUNDER"): 1.00,
    ("GEO_MET_IMAGER_SOUNDER", "POLAR_MET_SOUNDER"): 0.50,
    ("POLAR_MET_SOUNDER", "POLAR_MET_SOUNDER"): 1.00,
    ("IONOSPHERIC_BEACON", "IONOSPHERIC_BEACON"): 1.00,
}

# Related mission categories allowed as secondary cross-category candidates
RELATED_CATEGORIES: dict[str, set[str]] = {
    "Earth Observation": {"Earth Observation", "Disaster Monitoring", "Weather"},
    "Disaster Monitoring": {"Disaster Monitoring", "Earth Observation"},
    "Weather": {"Weather", "Earth Observation"},
    "Scientific / Student": {"Scientific / Student", "Earth Observation"},
}


def _sensor_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    return SENSOR_FAMILY_COMPATIBILITY.get((a, b), SENSOR_FAMILY_COMPATIBILITY.get((b, a), 0.0))


def _compare_sensor(
    target: SatelliteRecord, candidate: SatelliteRecord
) -> tuple[FieldComparisonItem, Optional[str]]:
    max_pts = ALTERNATIVE_MATCH_WEIGHTS["sensorType"]
    sim = _sensor_similarity(target.capabilities.sensorFamily, candidate.capabilities.sensorFamily)
    pts = int(round(max_pts * sim))

    limitation: Optional[str] = None
    if sim >= 0.95:
        status = "MATCH"
    elif sim >= 0.55:
        status = "PARTIAL"
        limitation = (
            f"Different sensor architecture ({candidate.capabilities.sensorType} vs. "
            f"{target.capabilities.sensorType}); calibration or processing changes required."
        )
    else:
        status = "GAP"
        limitation = (
            f"Different sensor modality ({candidate.capabilities.sensorType} vs. "
            f"{target.capabilities.sensorType})."
        )

    if target.capabilities.allWeatherCapable and not candidate.capabilities.allWeatherCapable:
        status = "GAP" if sim < 0.55 else "PARTIAL"
        limitation = (
            "No all-weather cloud penetration: candidate optical/IR sensor is blocked by dense monsoon "
            "or cyclone cloud cover."
        )

    return (
        FieldComparisonItem(
            field="sensorType",
            label="Sensor type",
            targetValue=target.capabilities.sensorType,
            alternativeValue=candidate.capabilities.sensorType,
            matchPoints=pts,
            maxPoints=max_pts,
            comparisonStatus=status,  # type: ignore[arg-type]
            limitationNote=limitation,
        ),
        limitation,
    )


def _compare_resolution(
    target: SatelliteRecord, candidate: SatelliteRecord
) -> tuple[FieldComparisonItem, Optional[str]]:
    max_pts = ALTERNATIVE_MATCH_WEIGHTS["spatialResolution"]
    t_res = target.capabilities.spatialResolutionMeters
    c_res = candidate.capabilities.spatialResolutionMeters

    limitation: Optional[str] = None
    if t_res is None or c_res is None:
        pts = int(round(max_pts * 0.5))
        status = "PARTIAL"
        limitation = "Spatial resolution cannot be directly compared from verified public specifications."
    elif c_res <= t_res * 1.25:
        pts = max_pts
        status = "MATCH"
    elif c_res <= t_res * 4.0:
        pts = int(round(max_pts * 0.65))
        status = "PARTIAL"
        limitation = (
            f"Lower spatial resolution (~{c_res:g} m vs. target ~{t_res:g} m nominal finest mode)."
        )
    else:
        pts = int(round(max_pts * 0.25))
        status = "GAP"
        limitation = (
            f"Significantly lower spatial resolution (~{c_res:g} m vs. target ~{t_res:g} m); "
            "cannot resolve fine-scale infrastructure damage."
        )

    return (
        FieldComparisonItem(
            field="spatialResolution",
            label="Spatial resolution",
            targetValue=target.capabilities.spatialResolution,
            alternativeValue=candidate.capabilities.spatialResolution,
            matchPoints=pts,
            maxPoints=max_pts,
            comparisonStatus=status,  # type: ignore[arg-type]
            limitationNote=limitation,
        ),
        limitation,
    )


def _compare_revisit(
    target: SatelliteRecord, candidate: SatelliteRecord
) -> tuple[FieldComparisonItem, Optional[str]]:
    max_pts = ALTERNATIVE_MATCH_WEIGHTS["revisitTime"]
    t_rev = target.capabilities.revisitDays
    c_rev = candidate.capabilities.revisitDays

    limitation: Optional[str] = None
    if target.orbitRegime == "GEO" and candidate.orbitRegime != "GEO":
        pts = int(round(max_pts * 0.25))
        status = "GAP"
        limitation = (
            "Slower revisit / orbit mismatch: target provides continuous geostationary viewing, "
            "whereas candidate operates in polar LEO with intermittent passes."
        )
    elif t_rev is None or c_rev is None:
        pts = int(round(max_pts * 0.5))
        status = "PARTIAL"
        limitation = "Nominal revisit cadence is not fully verified for direct comparison."
    elif c_rev <= t_rev * 1.2:
        pts = max_pts
        status = "MATCH"
    elif c_rev <= t_rev * 2.5:
        pts = int(round(max_pts * 0.6))
        status = "PARTIAL"
        limitation = f"Slower nominal revisit (~{c_rev:g} days vs. target ~{t_rev:g} days)."
    else:
        pts = int(round(max_pts * 0.3))
        status = "GAP"
        limitation = f"Much slower nominal revisit (~{c_rev:g} days vs. target ~{t_rev:g} days)."

    return (
        FieldComparisonItem(
            field="revisitTime",
            label="Revisit time",
            targetValue=target.capabilities.revisitTime,
            alternativeValue=candidate.capabilities.revisitTime,
            matchPoints=pts,
            maxPoints=max_pts,
            comparisonStatus=status,  # type: ignore[arg-type]
            limitationNote=limitation,
        ),
        limitation,
    )


def _compare_coverage(
    target: SatelliteRecord, candidate: SatelliteRecord
) -> tuple[FieldComparisonItem, Optional[str]]:
    max_pts = ALTERNATIVE_MATCH_WEIGHTS["coverage"]
    t_regions = {r.lower() for r in target.capabilities.coverageRegions}
    c_regions = {r.lower() for r in candidate.capabilities.coverageRegions}

    limitation: Optional[str] = None
    if "global" in c_regions:
        overlap_ratio = 0.90 if "india" in t_regions and "india" not in c_regions else 1.0
    else:
        specific_target = t_regions - {"global"}
        if not specific_target:
            overlap_ratio = 0.7
        else:
            overlap_ratio = len(specific_target.intersection(c_regions)) / len(specific_target)

    pts = int(round(max_pts * overlap_ratio))
    if overlap_ratio >= 0.85:
        status = "MATCH"
    elif overlap_ratio >= 0.45:
        status = "PARTIAL"
        limitation = (
            f"Different geographic coverage focus ({candidate.capabilities.coverage}); "
            "viewing geometry over primary target region may be partial or oblique."
        )
    else:
        status = "GAP"
        limitation = f"Limited geographic coverage overlap ({candidate.capabilities.coverage})."

    return (
        FieldComparisonItem(
            field="coverage",
            label="Coverage",
            targetValue=target.capabilities.coverage,
            alternativeValue=candidate.capabilities.coverage,
            matchPoints=pts,
            maxPoints=max_pts,
            comparisonStatus=status,  # type: ignore[arg-type]
            limitationNote=limitation,
        ),
        limitation,
    )


def _compare_data_access(
    target: SatelliteRecord, candidate: SatelliteRecord
) -> tuple[FieldComparisonItem, Optional[str]]:
    max_pts = ALTERNATIVE_MATCH_WEIGHTS["dataAccess"]
    same_operator = candidate.operator.lower() == target.operator.lower()
    tier = candidate.capabilities.dataAccessTier

    limitation: Optional[str] = None
    if same_operator:
        pts = max_pts
        status = "MATCH"
    elif tier == "OPEN_PUBLIC":
        pts = int(round(max_pts * 0.80))
        status = "PARTIAL"
        limitation = (
            f"External operator ({candidate.operator}); open public archive removes licensing cost, "
            "but acquisition schedules cannot be domestically tasked on demand."
        )
    elif tier == "CHARTER_TASKED":
        pts = int(round(max_pts * 0.55))
        status = "PARTIAL"
        limitation = (
            f"Restricted external access ({candidate.capabilities.dataAccess}); requires International "
            "Charter activation or partner tasking lead time."
        )
    elif tier == "COMMERCIAL":
        pts = int(round(max_pts * 0.45))
        status = "GAP"
        limitation = (
            f"Commercial licensed access ({candidate.operator}); requires procurement agreement and "
            "commercial tasking windows."
        )
    else:
        pts = int(round(max_pts * 0.40))
        status = "GAP"
        limitation = f"Restricted or institutional access ({candidate.capabilities.dataAccess})."

    return (
        FieldComparisonItem(
            field="dataAccess",
            label="Data access",
            targetValue=target.capabilities.dataAccess,
            alternativeValue=candidate.capabilities.dataAccess,
            matchPoints=pts,
            maxPoints=max_pts,
            comparisonStatus=status,  # type: ignore[arg-type]
            limitationNote=limitation,
        ),
        limitation,
    )


def find_alternatives(
    target: SatelliteRecord,
    db: MissionDatabase,
    *,
    max_results: int = 5,
) -> AlternativesResponse:
    """Compare target satellite against mission catalog and return alternatives + redundancy gaps."""
    allowed_categories = RELATED_CATEGORIES.get(target.category, {target.category})
    target_services = {s.serviceId for s in target.supportedServices}

    candidates: list[AlternativeCandidate] = []
    for cand in db.list_all():
        if cand.noradId == target.noradId:
            continue
        if cand.status == "Inactive":
            continue

        same_cat = cand.category == target.category
        related_cat = cand.category in allowed_categories
        cand_services = {s.serviceId for s in cand.supportedServices}
        shared_services = target_services.intersection(cand_services)
        sensor_sim = _sensor_similarity(
            target.capabilities.sensorFamily, cand.capabilities.sensorFamily
        )

        # Must share mission category OR have meaningful sensor/service overlap
        if not same_cat and not (related_cat and (sensor_sim >= 0.40 or shared_services)):
            continue
        if sensor_sim == 0.0 and not shared_services and not same_cat:
            continue

        comparisons: list[FieldComparisonItem] = []
        limitations: list[str] = []
        for fn in (
            _compare_sensor,
            _compare_resolution,
            _compare_revisit,
            _compare_coverage,
            _compare_data_access,
        ):
            item, lim = fn(target, cand)
            comparisons.append(item)
            if lim:
                limitations.append(lim)

        raw_match = sum(c.matchPoints for c in comparisons)
        # Never report 100% — orbital phasing and operational control never give a true 1:1 drop-in
        capability_match = max(0, min(95, raw_match))

        if capability_match < 30:
            continue

        if not limitations:
            limitations.append(
                "Orbital slot or pass timing differs from the target satellite; scheduling coordination is still required."
            )

        candidates.append(
            AlternativeCandidate(
                noradId=cand.noradId,
                verifiedNoradId=cand.verifiedNoradId,
                name=cand.name,
                operator=cand.operator,
                country=cand.country,
                category=cand.category,
                status=cand.status,
                capabilityMatch=capability_match,
                comparison=comparisons,
                limitations=limitations,
                dataSource=cand.dataSource,
                sources=cand.sources,
            )
        )

    candidates.sort(key=lambda c: (c.capabilityMatch, c.country == target.country), reverse=True)
    top_candidates = candidates[:max_results]

    redundancy_gaps = _build_redundancy_gaps(target, top_candidates)

    methodology = (
        "Deterministic 0-100 rule summing per-field compatibility: "
        "sensorType (35) + spatialResolution (20) + revisitTime (15) + coverage (15) + dataAccess (15), "
        "capped at 95 to reflect inherent orbital phasing and operational differences."
    )

    return AlternativesResponse(
        noradId=target.noradId,
        verifiedNoradId=target.verifiedNoradId,
        name=target.name,
        category=target.category,
        matchingMethodology=methodology,
        alternatives=top_candidates,
        redundancyGaps=redundancy_gaps,
        caveat=ALTERNATIVE_CAVEAT_TEXT,
        dataSource=target.dataSource,
    )


def _build_redundancy_gaps(
    target: SatelliteRecord,
    alternatives: list[AlternativeCandidate],
) -> list[str]:
    gaps: list[str] = []

    if not alternatives:
        gaps.append(
            f"No operational alternative satellite with comparable capability was found in the catalog for {target.name}."
        )
        return gaps

    same_country = [a for a in alternatives if a.country.lower() == target.country.lower()]
    if not same_country:
        gaps.append(
            f"No operational domestic ({target.country}) backup satellite in the catalog matches {target.name}; "
            "service continuity would rely on external international operators."
        )

    if target.capabilities.allWeatherCapable:
        if any(
            any("all-weather" in lim.lower() for lim in alt.limitations)
            for alt in alternatives[:3]
        ):
            gaps.append(
                "Optical alternatives cannot penetrate monsoon or cyclonic cloud cover, leaving an all-weather observation gap."
            )
        if not same_country:
            gaps.append(
                "All-weather radar continuity depends on international SAR missions with pre-scheduled or charter-tasked passes rather than direct sovereign tasking."
            )

    if target.capabilities.spatialResolutionMeters is not None and target.capabilities.spatialResolutionMeters <= 1.0:
        if all(
            any("lower spatial resolution" in lim.lower() for lim in alt.limitations)
            for alt in alternatives
        ):
            gaps.append(
                f"None of the catalogued alternatives match {target.name}'s sub-metre/1 m class spatial resolution."
            )

    if target.orbitRegime == "GEO":
        if any("slower revisit" in lim.lower() for alt in alternatives for lim in alt.limitations):
            gaps.append(
                "Polar LEO meteorological alternatives cannot replace continuous geostationary rapid-scan imaging."
            )
        if any(s.serviceId == "search_and_rescue" for s in target.supportedServices):
            gaps.append(
                "External geostationary weather satellites (e.g., Meteosat-9, Himawari-9) do not carry domestic ISRO Data Relay (DRT) or SAS&R distress-beacon transponders."
            )

    if not gaps:
        gaps.append(
            "Even where sensor capabilities overlap, orbital pass timing, viewing angle, and operator tasking rules create temporary coverage gaps."
        )

    return gaps
