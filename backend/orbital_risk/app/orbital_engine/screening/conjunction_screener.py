"""Deterministic Close-Approach Conjunction Screener.

Screens operational priority satellites against catalogued space debris.
Features:
  - Two-tier screening (apogee/perigee geometric filter + coarse-to-fine SGP4 search)
  - Stable event IDs (format: CONJ-YYYY-NNNN)
  - 60-second TTL performance caching
  - Physical uncertainty estimation (tleUncertaintyKm)
  - Strict compliance: NO collision probability or pc values calculated or reported
"""

import math
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

from app.core.config import settings
from app.schemas.orbital import ConjunctionEvent, SatelliteSummary
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator
from app.orbital_engine.screening.filter_apogee_perigee import orbits_can_intersect

# In-memory LRU-like 60-second cache
_SCREENING_CACHE: Dict[str, Tuple[float, List[ConjunctionEvent]]] = {}
# Stable ID registry mapping unique encounter keys to CONJ-YYYY-NNNN
_EVENT_ID_REGISTRY: Dict[str, str] = {}
_NEXT_EVENT_NUM: int = 1


def _get_stable_event_id(primary_id: int, secondary_id: int, tca_epoch: int) -> str:
    """Generate or retrieve a stable CONJ-YYYY-NNNN event ID."""
    global _NEXT_EVENT_NUM
    # Cluster within a 10-minute window for stable encounter identity
    cluster_key = f"{primary_id}_{secondary_id}_{tca_epoch // 600}"
    if cluster_key not in _EVENT_ID_REGISTRY:
        year = datetime.fromtimestamp(tca_epoch, tz=timezone.utc).year
        _EVENT_ID_REGISTRY[cluster_key] = f"CONJ-{year}-{_NEXT_EVENT_NUM:04d}"
        _NEXT_EVENT_NUM += 1
    return _EVENT_ID_REGISTRY[cluster_key]


class ConjunctionScreener:
    """Screening engine calculating flagged close approaches between satellites and debris."""

    def __init__(
        self,
        coarse_step_seconds: int = 60,
        fine_step_seconds: int = 2,
    ):
        self.coarse_step = coarse_step_seconds
        self.fine_step = fine_step_seconds

    def screen_all(
        self,
        priority_satellites: List[SatelliteSummary],
        debris_objects: List[SatelliteSummary],
        propagators: Dict[int, SGP4Propagator],
        window_hours: float = 48.0,
        max_separation_km: float = 15.0,
        force_recompute: bool = False,
    ) -> List[ConjunctionEvent]:
        """Screen all priority satellites against catalogued debris over windowHours.

        Caches results for 60 seconds to ensure high API responsiveness.
        """
        cache_key = f"{round(window_hours, 1)}_{round(max_separation_km, 1)}"
        now_ts = time.time()

        if not force_recompute and cache_key in _SCREENING_CACHE:
            cached_time, cached_events = _SCREENING_CACHE[cache_key]
            if (now_ts - cached_time) < settings.CONJUNCTION_CACHE_TTL_SECONDS:
                return cached_events

        start_time = datetime.now(timezone.utc)
        found_events: List[ConjunctionEvent] = []

        for sat in priority_satellites:
            sat_prop = propagators.get(sat.noradId)
            if not sat_prop:
                continue

            for deb in debris_objects:
                if sat.noradId == deb.noradId:
                    continue

                deb_prop = propagators.get(deb.noradId)
                if not deb_prop:
                    continue

                events = self._screen_pair(
                    primary=sat_prop,
                    primary_summary=sat,
                    secondary=deb_prop,
                    secondary_summary=deb,
                    start_time=start_time,
                    window_hours=window_hours,
                    max_separation_km=max_separation_km,
                )
                found_events.extend(events)

        # Sort by miss distance ascending
        found_events.sort(key=lambda x: x.missDistanceKm)

        # Store in 60s cache
        _SCREENING_CACHE[cache_key] = (now_ts, found_events)
        return found_events

    def _screen_pair(
        self,
        primary: SGP4Propagator,
        primary_summary: SatelliteSummary,
        secondary: SGP4Propagator,
        secondary_summary: SatelliteSummary,
        start_time: datetime,
        window_hours: float,
        max_separation_km: float,
    ) -> List[ConjunctionEvent]:
        """Screen a single satellite-debris pair using two-tier filtering."""
        events: List[ConjunctionEvent] = []

        # Tier 1: Geometric altitude shell filter
        p_params = primary.compute_orbital_parameters()
        s_params = secondary.compute_orbital_parameters()
        can_intersect, _ = orbits_can_intersect(p_params, s_params, threshold_km=max_separation_km)

        if not can_intersect:
            return events

        # Tier 2: Coarse SGP4 time propagation
        total_coarse_steps = int((window_hours * 3600) / self.coarse_step)
        sample_times = [start_time + timedelta(seconds=i * self.coarse_step) for i in range(total_coarse_steps)]

        dists = []
        for t in sample_times:
            e1, r1, _ = primary.propagate_state(t)
            e2, r2, _ = secondary.propagate_state(t)

            if e1 != 0 or e2 != 0:
                dists.append(1e9)
                continue

            dx = r1[0] - r2[0]
            dy = r1[1] - r2[1]
            dz = r1[2] - r2[2]
            d = math.sqrt(dx * dx + dy * dy + dz * dz)
            dists.append(d)

        if len(dists) < 3:
            return events

        dists_arr = np.array(dists)
        detection_limit = max_separation_km * 2.0
        minima_indices: List[int] = []

        # Find local minima separated by at least 30 minutes
        min_separation_steps = max(1, int(1800 / self.coarse_step))
        last_step = -min_separation_steps

        for i in range(1, len(dists_arr) - 1):
            if (
                dists_arr[i] < detection_limit
                and dists_arr[i] < dists_arr[i - 1]
                and dists_arr[i] < dists_arr[i + 1]
            ):
                if (i - last_step) >= min_separation_steps:
                    minima_indices.append(i)
                    last_step = i

        # Refine around each local minimum with fine-grained time stepping
        for min_idx in minima_indices:
            t_center = sample_times[min_idx]
            t_start = t_center - timedelta(seconds=self.coarse_step)
            t_end = t_center + timedelta(seconds=self.coarse_step)

            tca, min_d, rel_v, alt_at_tca = self._refine_tca(primary, secondary, t_start, t_end)

            if min_d <= max_separation_km:
                event_id = _get_stable_event_id(primary_summary.noradId, secondary_summary.noradId, int(tca.timestamp()))

                # Estimate 1-sigma positional uncertainty from TLE age and BSTAR
                bstar = primary.satrec.bstar
                tle_uncertainty = round(max(0.5, min(6.0, 1.2 + abs(bstar) * 25000.0)), 2)

                # Provenance: real if both objects are live CelesTrak, otherwise mock
                event_data_source = (
                    "real" if (primary_summary.dataSource == "real" and secondary_summary.dataSource == "real")
                    else "mock"
                )

                screening_note = (
                    f"Flagged close approach from preliminary SGP4 screening against catalogued "
                    f"{secondary_summary.name} ({secondary_summary.type}). "
                    f"Predicted miss distance: {round(min_d, 2)} km at relative velocity {round(rel_v, 2)} km/s."
                )

                events.append(
                    ConjunctionEvent(
                        eventId=event_id,
                        primaryObject=primary_summary,
                        secondaryObject=secondary_summary,
                        tcaUtc=tca.isoformat(),
                        missDistanceKm=round(min_d, 3),
                        relativeVelocityKmS=round(rel_v, 3),
                        altitudeAtTcaKm=round(alt_at_tca, 2),
                        tleEpochUtc=primary_summary.tleEpochUtc,
                        tleUncertaintyKm=tle_uncertainty,
                        screeningNote=screening_note,
                        dataSource=event_data_source,
                        isPreliminaryScreening=True,
                        investigationStatus="UNREVIEWED",
                    )
                )

        return events

    def _refine_tca(
        self,
        primary: SGP4Propagator,
        secondary: SGP4Propagator,
        t_start: datetime,
        t_end: datetime,
    ) -> Tuple[datetime, float, float, float]:
        """Refine Time of Closest Approach using fine time stepping."""
        curr = t_start
        best_tca = t_start
        min_dist = 1e9
        rel_vel = 0.0
        alt_tca = 500.0

        while curr <= t_end:
            e1, r1, v1 = primary.propagate_state(curr)
            e2, r2, v2 = secondary.propagate_state(curr)

            if e1 == 0 and e2 == 0:
                dx = r1[0] - r2[0]
                dy = r1[1] - r2[1]
                dz = r1[2] - r2[2]
                dist = math.sqrt(dx * dx + dy * dy + dz * dz)

                if dist < min_dist:
                    min_dist = dist
                    best_tca = curr

                    dvx = v1[0] - v2[0]
                    dvy = v1[1] - v2[1]
                    dvz = v1[2] - v2[2]
                    rel_vel = math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz)

                    # Geocentric radial altitude approximate
                    r_mag = math.sqrt(r1[0] ** 2 + r1[1] ** 2 + r1[2] ** 2)
                    alt_tca = max(0.0, r_mag - 6378.137)

            curr += timedelta(seconds=self.fine_step)

        return best_tca, min_dist, rel_vel, alt_tca


screener = ConjunctionScreener()
