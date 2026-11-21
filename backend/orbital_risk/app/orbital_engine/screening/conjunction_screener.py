"""Deterministic Conjunction Screener.

Performs preliminary close-approach screening between an operational satellite
and catalogued objects (operational satellites, rocket bodies, debris).
Uses a two-tier pipeline:
  1. Apogee-Perigee geometric altitude filter
  2. Coarse time-series propagation + fine-grained TCA local minima refinement
"""

import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple
import numpy as np

from app.schemas.orbital import (
    CloseApproachEvent,
    ObjectType,
    ScreeningPriority,
    CalculationStatus,
    DataFidelity,
)
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator
from app.orbital_engine.screening.filter_apogee_perigee import orbits_can_intersect


class ConjunctionScreener:
    """Performs close-approach screening across satellite and debris candidates."""

    def __init__(
        self,
        coarse_step_seconds: int = 60,
        fine_step_seconds: int = 2,
    ):
        self.coarse_step = coarse_step_seconds
        self.fine_step = fine_step_seconds

    def screen_pair(
        self,
        primary: SGP4Propagator,
        secondary: SGP4Propagator,
        secondary_meta: Dict[str, Any],
        start_time: datetime,
        window_hours: float,
        threshold_km: float = 15.0,
    ) -> List[CloseApproachEvent]:
        """Screen a single pair of objects over the prediction window."""
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        events: List[CloseApproachEvent] = []

        # 1. Geometric filter
        p_params = primary.compute_orbital_parameters()
        s_params = secondary.compute_orbital_parameters()
        can_intersect, _ = orbits_can_intersect(p_params, s_params, threshold_km=threshold_km)

        if not can_intersect:
            return events

        # 2. Coarse time propagation
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
        detection_limit = threshold_km * 2.0
        minima_indices: List[int] = []

        # 3. Detect strict local minima below threshold * 2.0
        # Enforce minimum temporal separation (30 minutes = 1800s = 30 coarse steps)
        min_separation_steps = max(1, int(1800 / self.coarse_step))
        last_added_step = -min_separation_steps

        for i in range(1, len(dists_arr) - 1):
            if (
                dists_arr[i] < detection_limit
                and dists_arr[i] < dists_arr[i - 1]
                and dists_arr[i] < dists_arr[i + 1]
            ):
                if (i - last_added_step) >= min_separation_steps:
                    minima_indices.append(i)
                    last_added_step = i

        # 4. Refine around each detected local minimum
        for min_idx in minima_indices:
            t_center = sample_times[min_idx]
            t_start = t_center - timedelta(seconds=self.coarse_step)
            t_end = t_center + timedelta(seconds=self.coarse_step)

            tca, min_d, rel_v, _ = self._refine_tca(primary, secondary, t_start, t_end)

            if min_d <= threshold_km:
                priority = self._classify_priority(min_d)
                event_id = f"CA-{primary.norad_id}-{secondary.norad_id}-{int(tca.timestamp())}"

                sec_type_str = secondary_meta.get("OBJECT_TYPE", "DEBRIS").upper()
                sec_type = (
                    ObjectType.PAYLOAD if "PAYLOAD" in sec_type_str
                    else ObjectType.ROCKET_BODY if "ROCKET" in sec_type_str
                    else ObjectType.DEBRIS
                )

                fidelity_str = secondary_meta.get("DATA_SOURCE", "REAL_CELESTRAK")
                fidelity = (
                    DataFidelity.SYNTHETIC_SCENARIO if "SYNTHETIC" in fidelity_str
                    else DataFidelity.REAL_CACHED if "CACHE" in fidelity_str
                    else DataFidelity.REAL_CELESTRAK
                )

                events.append(
                    CloseApproachEvent(
                        event_id=event_id,
                        primary_norad_id=primary.norad_id,
                        primary_name=primary.name,
                        secondary_norad_id=secondary.norad_id,
                        secondary_name=secondary.name,
                        secondary_type=sec_type,
                        tca_utc=tca,
                        miss_distance_km=round(min_d, 3),
                        relative_velocity_km_s=round(rel_v, 3),
                        screening_priority=priority,
                        calculation_status=CalculationStatus.COMPLETED,
                        data_fidelity=fidelity,
                        time_window_hours=window_hours,
                    )
                )

        return events

    def _refine_tca(
        self,
        primary: SGP4Propagator,
        secondary: SGP4Propagator,
        t_start: datetime,
        t_end: datetime,
    ) -> Tuple[datetime, float, float, Tuple[float, float, float]]:
        """Refine Time of Closest Approach using fine time stepping."""
        curr = t_start
        best_tca = t_start
        min_dist = 1e9
        rel_vel = 0.0
        best_diff = (0.0, 0.0, 0.0)

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
                    best_diff = (dx, dy, dz)

                    dvx = v1[0] - v2[0]
                    dvy = v1[1] - v2[1]
                    dvz = v1[2] - v2[2]
                    rel_vel = math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz)

            curr += timedelta(seconds=self.fine_step)

        return best_tca, min_dist, rel_vel, best_diff

    @staticmethod
    def _classify_priority(miss_distance_km: float) -> ScreeningPriority:
        """Assign preliminary triage priority based purely on physical miss distance."""
        if miss_distance_km < 1.0:
            return ScreeningPriority.URGENT_INVESTIGATION
        elif miss_distance_km < 5.0:
            return ScreeningPriority.WARNING
        elif miss_distance_km < 15.0:
            return ScreeningPriority.ADVISORY
        return ScreeningPriority.INFORMATIONAL
