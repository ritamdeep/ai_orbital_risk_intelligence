"""Unit tests for geometric altitude filter and conjunction screening."""

from datetime import datetime, timezone
import pytest
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator
from app.orbital_engine.screening.filter_apogee_perigee import orbits_can_intersect
from app.orbital_engine.screening.conjunction_screener import ConjunctionScreener
from app.schemas.orbital import ScreeningPriority
from app.orbital_engine.scenarios.test_scenarios import CURATED_OBJECTS


def test_geometric_filter_separated_orbits():
    """Verify that widely separated orbital shells are rejected by the geometric filter."""
    leo_orbit = {"perigee_km": 500.0, "apogee_km": 550.0}
    geo_orbit = {"perigee_km": 35780.0, "apogee_km": 35790.0}

    can_intersect, dist = orbits_can_intersect(leo_orbit, geo_orbit, threshold_km=15.0)
    assert can_intersect is False
    assert dist > 35000.0


def test_geometric_filter_overlapping_orbits():
    """Verify that intersecting or overlapping orbital shells pass the geometric filter."""
    orbit_a = {"perigee_km": 520.0, "apogee_km": 540.0}
    orbit_b = {"perigee_km": 525.0, "apogee_km": 545.0}

    can_intersect, _ = orbits_can_intersect(orbit_a, orbit_b, threshold_km=15.0)
    assert can_intersect is True


def test_conjunction_detection_eos04_vs_cosmos2251():
    """Verify that close-approach encounter between EOS-04 and Cosmos-2251 debris is detected."""
    eos04_raw = next(o for o in CURATED_OBJECTS if o["NORAD_CAT_ID"] == 51656)
    deb_raw = next(o for o in CURATED_OBJECTS if o["NORAD_CAT_ID"] == 34454)

    prop_eos = SGP4Propagator.from_omm(eos04_raw)
    prop_deb = SGP4Propagator.from_omm(deb_raw)

    screener = ConjunctionScreener(coarse_step_seconds=30, fine_step_seconds=1)

    start_time = datetime(2026, 11, 20, 0, 0, 0, tzinfo=timezone.utc)
    events = screener.screen_pair(
        primary=prop_eos,
        secondary=prop_deb,
        secondary_meta=deb_raw,
        start_time=start_time,
        window_hours=6.0,
        threshold_km=15.0,
    )

    assert len(events) >= 1
    closest = events[0]

    assert closest.miss_distance_km <= 15.0
    assert closest.screening_priority in (
        ScreeningPriority.URGENT_INVESTIGATION,
        ScreeningPriority.WARNING,
        ScreeningPriority.ADVISORY,
    )
    # Check scientific disclaimer is present
    assert "PRELIMINARY_SCREENING_ONLY" in closest.disclaimer
