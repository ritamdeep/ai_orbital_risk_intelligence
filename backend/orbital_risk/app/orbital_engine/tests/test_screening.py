"""Unit tests for geometric altitude filter and conjunction screening."""

from datetime import datetime, timezone
import pytest
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator
from app.orbital_engine.screening.filter_apogee_perigee import orbits_can_intersect
from app.orbital_engine.screening.conjunction_screener import ConjunctionScreener
from app.orbital_engine.scenarios.test_scenarios import CURATED_OBJECTS
from app.orbital_engine.clients.celestrak_client import data_store


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
    sat_summary = data_store.get_satellite_summary(51656) # EOS-04
    deb_summary = data_store.get_satellite_summary(34454) # COSMOS 2251 DEBRIS

    assert sat_summary is not None
    assert deb_summary is not None

    prop_eos = data_store.get_propagator(51656)
    prop_deb = data_store.get_propagator(34454)

    assert prop_eos is not None
    assert prop_deb is not None

    screener = ConjunctionScreener(coarse_step_seconds=30, fine_step_seconds=1)

    start_time = datetime.now(timezone.utc)
    events = screener._screen_pair(
        primary=prop_eos,
        primary_summary=sat_summary,
        secondary=prop_deb,
        secondary_summary=deb_summary,
        start_time=start_time,
        window_hours=48.0,
        max_separation_km=50.0,
    )

    # Screening should flag close approaches under threshold
    for ev in events:
        assert ev.missDistanceKm <= 50.0
        assert ev.isPreliminaryScreening is True
        assert "Flagged close approach" in ev.screeningNote
        assert ev.eventId.startswith("CONJ-")
