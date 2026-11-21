"""Unit tests for SGP4 propagation and coordinate transformations."""

from datetime import datetime, timezone
import pytest
from app.orbital_engine.propagator.sgp4_propagator import SGP4Propagator
from app.orbital_engine.propagator.coordinates import (
    datetime_to_julian,
    gmst_radians,
    teme_to_geodetic,
    WGS84_A,
)
from app.orbital_engine.scenarios.test_scenarios import CURATED_OBJECTS


def test_julian_date_calculation():
    """Verify Julian date conversion against known benchmark (J2000 epoch)."""
    # 2000-01-01 12:00:00 UTC = 2451545.0 JD
    dt = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    jd_day, fraction = datetime_to_julian(dt)
    jd_total = jd_day + fraction
    assert pytest.approx(jd_total, abs=1e-5) == 2451545.0


def test_gmst_range():
    """Verify Greenwich Mean Sidereal Time produces radians in [0, 2pi)."""
    dt = datetime(2026, 11, 22, 0, 0, 0, tzinfo=timezone.utc)
    jd_day, fraction = datetime_to_julian(dt)
    gmst = gmst_radians(jd_day, fraction)
    assert 0.0 <= gmst < 6.283185307179586


def test_sgp4_propagation_eos04():
    """Verify SGP4 propagator correctly initializes from OMM and produces valid physical state."""
    eos04_raw = next(o for o in CURATED_OBJECTS if o["NORAD_CAT_ID"] == 51656)
    propagator = SGP4Propagator.from_omm(eos04_raw)

    assert propagator.norad_id == 51656
    assert propagator.name == "EOS-04 (RISAT-1A)"

    params = propagator.compute_orbital_parameters()
    # EOS-04 is in a ~530 km altitude Sun-Synchronous LEO orbit (perigee ~496 km, apogee ~498 km)
    assert 490.0 <= params["perigee_km"] <= 550.0
    assert 490.0 <= params["apogee_km"] <= 550.0
    assert 90.0 <= params["period_min"] <= 100.0
    assert pytest.approx(params["inclination_deg"], abs=0.5) == 97.48

    # Propagate position at epoch
    pos = propagator.get_position(datetime(2026, 11, 20, 0, 0, 0, tzinfo=timezone.utc))
    assert pos is not None
    assert -90.0 <= pos.lat <= 90.0
    assert -180.0 <= pos.lon <= 180.0
    assert 500.0 <= pos.alt_km <= 600.0
    # Orbital speed in LEO should be approximately 7.5 to 7.8 km/s
    assert 7.4 <= pos.speed_km_s <= 7.9


def test_ephemeris_generation():
    """Verify forward trajectory ephemeris generation produces requested time series."""
    eos04_raw = next(o for o in CURATED_OBJECTS if o["NORAD_CAT_ID"] == 51656)
    propagator = SGP4Propagator.from_omm(eos04_raw)

    now = datetime.now(timezone.utc)
    trajectory = propagator.generate_ephemeris(start_time=now, duration_hours=1.0, step_seconds=120)

    # 1 hour at 120 second intervals = 30 intervals + 1 = 31 points
    assert len(trajectory) == 31
    for pt in trajectory:
        assert pt.alt_km > 400.0
        assert pt.speed_km_s > 7.0
