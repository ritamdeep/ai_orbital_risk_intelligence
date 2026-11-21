"""ASTRAVIGIL Orbital Risk Engine - API Contract & Quality Test Suite.

Verifies:
  1. Response shapes and data types matching the shared contract
  2. SGP4 propagation sanity check against known physical constraints
  3. Proper HTTP 404 and 422 error handling with the standard error shape
  4. Absolute prohibition of any 'probability' or 'pc' field in all responses
  5. Accurate dataSource tagging ('mock' for bundled offline seed data)
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from main import app
from app.orbital_engine.clients.celestrak_client import data_store

client = TestClient(app)


def test_health_endpoint_contract():
    """Verify /health returns expected fields and 200 status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "astravigil-orbital-backend"
    assert "version" in data
    assert "timestampUtc" in data
    assert data["tleSource"] in ("celestrak", "mock")
    assert isinstance(data["objectsCount"], int)
    assert data["objectsCount"] >= 5


def test_satellites_endpoint_and_type_filter():
    """Verify GET /api/orbital/satellites returns list with valid contract fields and filters."""
    response = client.get("/api/orbital/satellites")
    assert response.status_code == 200
    satellites = response.json()
    assert isinstance(satellites, list)
    assert len(satellites) >= 5

    # Check contract fields on the first satellite
    first = satellites[0]
    required_fields = [
        "noradId",
        "name",
        "type",
        "perigeeKm",
        "apogeeKm",
        "inclinationDeg",
        "periodMin",
        "tleEpochUtc",
        "position",
        "isActive",
        "dataSource",
    ]
    for field in required_fields:
        assert field in first, f"Missing required field: {field}"

    # Verify position sub-model
    pos = first["position"]
    pos_fields = ["timestampUtc", "latitude", "longitude", "altitudeKm", "eciX", "eciY", "eciZ", "speedKmS"]
    for pf in pos_fields:
        assert pf in pos, f"Missing position field: {pf}"

    # Verify type filter (debris)
    r_debris = client.get("/api/orbital/satellites?type=debris")
    assert r_debris.status_code == 200
    debris_list = r_debris.json()
    assert len(debris_list) >= 1
    for d in debris_list:
        assert d["type"].lower() == "debris"


def test_get_satellite_by_id():
    """Verify GET /api/orbital/satellites/{noradId} for EOS-04 (51656)."""
    response = client.get("/api/orbital/satellites/51656")
    assert response.status_code == 200
    data = response.json()
    assert data["noradId"] == 51656
    assert "EOS-04" in data["name"] or "EOS-4" in data["name"]
    assert data["type"] == "payload"
    assert data["isActive"] is True
    assert 450.0 <= data["perigeeKm"] <= 600.0


def test_satellite_not_found_404():
    """Verify 404 response and standard error shape for unknown noradId."""
    response = client.get("/api/orbital/satellites/999999")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "not found" in data["error"]["message"].lower()


def test_satellite_invalid_param_422():
    """Verify 422 response and standard error shape for malformed parameter."""
    response = client.get("/api/orbital/satellites/invalid-id")
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "Invalid request parameter" in data["error"]["message"]


def test_conjunctions_screening_endpoint_contract():
    """Verify GET /api/orbital/conjunctions returns flagged close approaches matching contract."""
    response = client.get("/api/orbital/conjunctions?windowHours=48&maxSeparationKm=50")
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)

    if events:
        event = events[0]
        # Stable ID check: CONJ-YYYY-NNNN
        assert event["eventId"].startswith("CONJ-")
        assert len(event["eventId"].split("-")) == 3

        # Physical metrics
        assert "tcaUtc" in event
        assert "missDistanceKm" in event
        assert "relativeVelocityKmS" in event
        assert "altitudeAtTcaKm" in event
        assert "tleEpochUtc" in event
        assert "tleUncertaintyKm" in event
        assert "screeningNote" in event
        assert "dataSource" in event
        assert event["isPreliminaryScreening"] is True
        assert event["investigationStatus"] in ("UNREVIEWED", "UNDER_EVALUATION", "MONITORING", "DISMISSED")

        # Nested object contracts
        assert "noradId" in event["primaryObject"]
        assert "noradId" in event["secondaryObject"]


def test_conjunction_event_by_id_and_404():
    """Verify GET /api/orbital/conjunctions/{eventId} lookup and 404."""
    # Unknown event ID
    r_notfound = client.get("/api/orbital/conjunctions/CONJ-9999-9999")
    assert r_notfound.status_code == 404
    err = r_notfound.json()
    assert err["error"]["code"] == "NOT_FOUND"


def test_sgp4_propagation_sanity_check():
    """Verify SGP4 propagation produces physically realistic LEO positions and speeds."""
    prop = data_store.get_propagator(51656) # EOS-04
    assert prop is not None

    now = datetime.now(timezone.utc)
    pos = prop.get_position(now)
    assert pos is not None
    # LEO altitude sanity bounds (400 - 800 km)
    assert 450.0 <= pos.alt_km <= 650.0
    # Orbital velocity in LEO is approximately 7.5 to 7.8 km/s
    assert 7.4 <= pos.speed_km_s <= 7.9
    # Geodetic bounds
    assert -90.0 <= pos.lat <= 90.0
    assert -180.0 <= pos.lon <= 180.0


def test_no_probability_or_pc_fields_in_any_response():
    """Crucial Rule: Verify NO response contains a field called 'probability' or 'pc'."""
    endpoints_to_test = [
        "/health",
        "/api/orbital/satellites",
        "/api/orbital/satellites/51656",
        "/api/orbital/conjunctions?windowHours=24&maxSeparationKm=50",
    ]

    for ep in endpoints_to_test:
        resp = client.get(ep)
        assert resp.status_code == 200, f"Endpoint {ep} failed"
        data = resp.json()

        # Recursively inspect every dictionary key in the response payload
        def assert_no_probability_keys(item, path=""):
            if isinstance(item, dict):
                for k, v in item.items():
                    k_lower = k.lower()
                    assert "probability" not in k_lower, f"Prohibited key '{k}' found at {path}"
                    assert k_lower != "pc", f"Prohibited key 'pc' found at {path}"
                    assert not k_lower.startswith("pc_"), f"Prohibited prefix 'pc_' found in key '{k}' at {path}"
                    assert not k_lower.endswith("_pc"), f"Prohibited suffix '_pc' found in key '{k}' at {path}"
                    assert_no_probability_keys(v, f"{path}.{k}")
            elif isinstance(item, list):
                for idx, elem in enumerate(item):
                    assert_no_probability_keys(elem, f"{path}[{idx}]")

        assert_no_probability_keys(data, path=ep)


def test_offline_bundled_data_source_is_mock():
    """Verify that satellites served from bundled seed data have dataSource: 'mock'."""
    response = client.get("/api/orbital/satellites/51656")
    assert response.status_code == 200
    data = response.json()
    if not data_store.is_live:
        assert data["dataSource"] == "mock"
