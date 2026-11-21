"""Automated tests for ASTRAVIGIL Member 3: AI & Mission Intelligence module."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.mission_intelligence.app import app
from backend.mission_intelligence.database import get_mission_db
from backend.mission_intelligence.schemas import ActiveEarthEvent, ConjunctionAlertInput, SeverityTier
from backend.mission_intelligence.scoring_engine import (
    compute_earth_impact,
    compute_explainable_priority,
    compute_mission_criticality,
)

client = TestClient(app)
SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_payloads"


def test_mission_database_loads_verified_satellites() -> None:
    db = get_mission_db()
    assert db.count() >= 18

    eos04 = db.get_by_norad_id(51656)
    assert eos04 is not None
    assert eos04.name == "EOS-04"
    assert eos04.operator == "ISRO"
    assert any(s.modality.value == "SAR_C_BAND" for s in eos04.sensors)
    assert any(d.service_id == "flood_monitoring" for d in eos04.active_service_dependencies)

    # Verify global SAR alternatives exist for continuity matching
    assert db.get_by_norad_id(39634) is not None  # Sentinel-1A
    assert db.get_by_norad_id(62261) is not None  # Sentinel-1C
    assert db.get_by_norad_id(39766) is not None  # ALOS-2
    assert db.get_by_norad_id(62701) is not None  # Pixxel Firefly-1
    assert db.get_by_norad_id(58989) is not None  # TIRSAT CubeSat


def test_dynamic_flood_multiplier_boosts_earth_impact_without_changing_orbital_risk() -> None:
    db = get_mission_db()
    eos04 = db.get_by_norad_id(51656)
    assert eos04 is not None

    base_alert = ConjunctionAlertInput(
        primary_norad_id=51656,
        secondary_name="FENGYUN 1C DEB",
        secondary_object_type="DEBRIS",
        tca_utc="2026-11-22T06:30:00Z",
        miss_distance_km=2.0,
        relative_velocity_kms=14.0,
        active_earth_events=[],
    )
    flood_alert = base_alert.model_copy(
        update={
            "active_earth_events": [
                ActiveEarthEvent(
                    event_type="flood_alert",
                    region="Assam / Brahmaputra Basin, India",
                    severity=SeverityTier.CRITICAL,
                )
            ]
        }
    )

    res_base = compute_explainable_priority(base_alert, eos04)
    res_flood = compute_explainable_priority(flood_alert, eos04)

    # Scientific Rule 4 & 5: Orbital screening dimension MUST remain identical regardless of Earth alerts
    assert res_base.orbital_screening.orbital_risk_score == res_flood.orbital_screening.orbital_risk_score
    assert res_base.orbital_screening.collision_probability is None
    assert res_flood.orbital_screening.collision_probability is None

    # Dynamic flood multiplier MUST boost Earth impact and Explainable Priority Score
    assert res_flood.earth_impact.dynamic_context_multiplier > 1.0
    assert res_flood.earth_impact.effective_earth_impact_score > res_base.earth_impact.effective_earth_impact_score
    assert res_flood.explainable_priority_score > res_base.explainable_priority_score
    assert len(res_flood.earth_impact.applied_multipliers) == 1
    assert res_flood.earth_impact.applied_multipliers[0].region_matched is True


def test_mission_criticality_orders_disaster_sat_above_experimental_cubesat() -> None:
    db = get_mission_db()
    eos04_crit = compute_mission_criticality(db.get_by_norad_id(51656))
    tirsat_crit = compute_mission_criticality(db.get_by_norad_id(58989))

    assert eos04_crit.mission_criticality_score > tirsat_crit.mission_criticality_score
    assert len(eos04_crit.criteria_breakdown) == 4
    assert abs(sum(c.weight for c in eos04_crit.criteria_breakdown) - 1.0) < 1e-6


def test_api_health_and_missions_endpoints() -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["catalog_satellites_loaded"] >= 18

    eos04_resp = client.get("/api/missions/51656")
    assert eos04_resp.status_code == 200
    data = eos04_resp.json()
    assert data["mission"]["name"] == "EOS-04"
    assert data["baseline_criticality"]["mission_criticality_score"] > 0.8
    assert data["provenance"]["mission_data_provenance"] == "verified_public_catalog"

    missing = client.get("/api/missions/999999")
    assert missing.status_code == 404


def test_api_alternatives_for_eos04_identifies_sar_backups_and_sovereign_gap() -> None:
    resp = client.get("/api/alternatives/51656?active_event_type=flood_alert&active_region=Assam")
    assert resp.status_code == 200
    body = resp.json()

    assert body["target_norad_id"] == 51656
    alt_names = [a["name"] for a in body["alternatives"]]
    assert "Sentinel-1A" in alt_names or "Sentinel-1C" in alt_names
    assert any(a["compatibility_score"] < 1.0 for a in body["alternatives"])
    assert all(len(a["gaps_and_limitations"]) > 0 for a in body["alternatives"])

    gap_types = {g["gap_type"] for g in body["redundancy_gaps"]}
    assert "SOVEREIGN_DOMESTIC_REDUNDANCY_GAP" in gap_types
    assert "SOVEREIGN_ALL_WEATHER_SAR_GAP" in gap_types
    assert "ACTIVE_DISASTER_REVISIT_SENSITIVITY" in gap_types


def test_api_analyze_impact_with_flood_sample_payload(monkeypatch) -> None:
    # Force deterministic fallback to guarantee offline test reproducibility
    monkeypatch.setenv("ASTRAVIGIL_LLM_PROVIDER", "fallback")

    payload = json.loads((SAMPLE_DIR / "flood_monitoring_eos04_alert.json").read_text(encoding="utf-8"))
    resp = client.post("/api/analyze-impact", json=payload)
    assert resp.status_code == 200
    body = resp.json()

    assert body["target_norad_id"] == 51656
    assert body["target_name"] == "EOS-04"
    assert body["is_catalogued_mission"] is True

    pa = body["priority_assessment"]
    assert pa["explainable_priority_score"] >= 60.0
    assert pa["priority_band"] == "CRITICAL_PRIORITY"
    assert pa["orbital_screening"]["collision_probability"] is None
    assert pa["earth_impact"]["dynamic_context_multiplier"] > 1.3
    assert "Orbital Screening Risk" in pa["formula_numeric_trace"]

    # Alternatives & service disruptions present
    assert len(body["disrupted_services"]) >= 1
    assert body["disrupted_services"][0]["service_id"] == "flood_monitoring"
    assert body["disrupted_services"][0]["elevated_by_active_event"] is True
    assert len(body["alternative_satellites"]) >= 3

    # AI advisory fallback adheres to scientific caveats
    advisory = body["ai_advisory"]
    assert advisory is not None
    assert advisory["generation_mode"] == "deterministic_fallback"
    assert "EOS-04" in advisory["headline"]
    assert len(advisory["recommended_operator_actions"]) >= 4
    assert len(advisory["scientific_caveats"]) >= 5
    assert body["provenance"]["conjunction_data_provenance"] == "simulated_scenario"


def test_api_analyze_impact_handles_uncatalogued_satellite_gracefully(monkeypatch) -> None:
    monkeypatch.setenv("ASTRAVIGIL_LLM_PROVIDER", "fallback")

    resp = client.post(
        "/api/analyze-impact",
        json={
            "primary_norad_id": 999888,
            "primary_name": "UNI-CUBESAT-DEMO",
            "secondary_name": "DEBRIS-X",
            "secondary_object_type": "DEBRIS",
            "tca_utc": "2026-11-23T02:00:00Z",
            "miss_distance_km": 4.2,
            "relative_velocity_kms": 11.5,
            "data_provenance": "simulated_scenario",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_catalogued_mission"] is False
    assert body["mission_profile"] is None
    assert body["priority_assessment"]["mission_criticality"]["mission_criticality_score"] == 0.5
    assert body["provenance"]["mission_data_provenance"] == "uncatalogued_fallback"
    assert body["ai_advisory"] is not None
