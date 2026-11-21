"""Integration tests for Orbital Risk Engine FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_and_system_health():
    """Verify system banner and health check."""
    r_root = client.get("/")
    assert r_root.status_code == 200
    data_root = r_root.json()
    assert data_root["platform"] == "ASTRAVIGIL"
    assert data_root["active_branch"] == "feature/orbital-risk"

    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "HEALTHY"


def test_orbital_health():
    """Verify /api/orbital/health endpoint telemetry."""
    response = client.get("/api/orbital/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["objects_cached_count"] >= 3
    assert data["debris_cached_count"] >= 2
    assert data["active_branch"] == "feature/orbital-risk"


def test_list_objects():
    """Verify /api/orbital/objects query."""
    response = client.get("/api/orbital/objects")
    assert response.status_code == 200
    objects = response.json()
    assert len(objects) >= 3

    # Filter by search
    r_search = client.get("/api/orbital/objects?search=EOS-04")
    assert r_search.status_code == 200
    assert len(r_search.json()) >= 1
    assert r_search.json()[0]["norad_id"] == 51656


def test_get_object_ephemeris():
    """Verify /api/orbital/objects/{norad_id}/ephemeris trajectory generation."""
    response = client.get("/api/orbital/objects/51656/ephemeris?duration_hours=1.0&step_seconds=120")
    assert response.status_code == 200
    ephem = response.json()
    assert ephem["norad_id"] == 51656
    assert ephem["name"] == "EOS-04 (RISAT-1A)"
    assert len(ephem["trajectory"]) == 31

    first_pt = ephem["trajectory"][0]
    assert "lat" in first_pt
    assert "lon" in first_pt
    assert "alt_km" in first_pt
    assert "eci_x_km" in first_pt


def test_list_debris():
    """Verify /api/orbital/debris returns only debris and rocket bodies."""
    response = client.get("/api/orbital/debris")
    assert response.status_code == 200
    debris = response.json()
    assert len(debris) >= 2
    for d in debris:
        assert d["norad_id"] in (34454, 25486, 30421)


def test_trigger_screening_api():
    """Verify on-demand screening POST /api/orbital/screenings."""
    payload = {
        "target_norad_id": 51656,
        "time_window_hours": 12.0,
        "threshold_km": 15.0,
        "include_operational": True,
        "include_debris": True,
    }
    response = client.post("/api/orbital/screenings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["target_norad_id"] == 51656
    assert data["potential_encounters_count"] >= 1
    assert "PRELIMINARY_SCREENING_ONLY" in data["disclaimer"]


def test_list_and_get_events():
    """Verify /api/orbital/events and /api/orbital/events/{event_id}."""
    r_list = client.get("/api/orbital/events")
    assert r_list.status_code == 200
    events = r_list.json()
    assert len(events) >= 1

    event_id = events[0]["event_id"]
    r_detail = client.get(f"/api/orbital/events/{event_id}")
    assert r_detail.status_code == 200
    detail = r_detail.json()
    assert detail["event_id"] == event_id
    assert "PRELIMINARY_SCREENING_ONLY" in detail["disclaimer"]
