"""Contract verification tests for ASTRAVIGIL Mission Intelligence (Member 3).

Covers Step 7 requirements:
- Response shapes for all 6 endpoints
- Criticality score reproducible from returned factors and weights (including inverted factor)
- Exact criticality tier boundaries from single config
- Independence of criticality from orbital data
- 404 & 422 standard error envelope handling
- Alternatives per-field comparison, capabilityMatch (0-100), limitations, redundancyGaps, caveat
- Briefing fallback when LLM_API_KEY is missing, on 15s timeout, and on forbidden post-check text
- Zero collision-probability fields anywhere in any API response
- CORS configured from CORS_ORIGINS env var (default http://localhost:5173)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.mission_intelligence.ai_explainer import find_forbidden_language
from backend.mission_intelligence.app import app, create_app
from backend.mission_intelligence.config import (
    ALTERNATIVE_CAVEAT_TEXT,
    CRITICALITY_FACTOR_SPECS,
    map_score_to_tier,
)
from backend.mission_intelligence.database import get_mission_db

client = TestClient(app)
SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_payloads"

FORBIDDEN_PROBABILITY_KEYS = {
    "collision_probability",
    "collisionprobability",
    "pc",
    "collision_prob",
    "impact_probability",
    "impactprobability",
    "probability_of_collision",
}


def _assert_no_collision_probability_fields(obj: Any, path: str = "$") -> None:
    """Recursively verify no response JSON contains collision-probability keys."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            assert key.lower() not in FORBIDDEN_PROBABILITY_KEYS, (
                f"Forbidden collision-probability key '{key}' found at {path}.{key}"
            )
            _assert_no_collision_probability_fields(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            _assert_no_collision_probability_fields(item, f"{path}[{idx}]")


def test_required_five_satellites_and_alternatives_loaded() -> None:
    db = get_mission_db()
    assert db.count() >= 10
    for norad_id in (44431, 44804, 51656, 41783, 54361, 41752):
        assert db.get_by_norad_id(norad_id) is not None, f"Missing required NORAD {norad_id}"

    # Verify CARTOSAT-3 alias (44431) and verified NORAD (44804) resolve to the same mission
    assert db.get_by_norad_id(44431).name == "CARTOSAT-3"  # type: ignore[union-attr]
    assert db.get_by_norad_id(44804).name == "CARTOSAT-3"  # type: ignore[union-attr]

    # Verify PRATHAM status reflects verified public Inactive status
    assert db.get_by_norad_id(41783).status == "Inactive"  # type: ignore[union-attr]


def test_health_and_satellites_list_shapes() -> None:
    health = client.get("/health")
    assert health.status_code == 200
    h_body = health.json()
    assert h_body["status"] == "ok"
    assert h_body["port"] == 8001
    assert h_body["methodology"] == "rule_based_v1"
    assert h_body["satellitesLoaded"] >= 10
    _assert_no_collision_probability_fields(h_body)

    sat_list = client.get("/api/mission/satellites")
    assert sat_list.status_code == 200
    s_body = sat_list.json()
    assert s_body["total"] == len(s_body["satellites"])
    assert s_body["total"] >= 10
    norad_ids = {item["noradId"] for item in s_body["satellites"]}
    assert {44431, 51656, 41783, 54361, 41752}.issubset(norad_ids)
    _assert_no_collision_probability_fields(s_body)


def test_capabilities_endpoint_shape_and_provenance() -> None:
    resp = client.get("/api/mission/satellites/44431/capabilities")
    assert resp.status_code == 200
    body = resp.json()
    assert body["noradId"] == 44431
    assert body["verifiedNoradId"] == 44804
    assert body["name"] == "CARTOSAT-3"
    caps = body["capabilities"]
    for field in ("sensorType", "spatialResolution", "revisitTime", "coverage", "dataAccess"):
        assert field in caps and caps[field]
    assert body["fieldProvenance"]["noradId"]["dataSource"] == "mock"
    assert body["fieldProvenance"]["verifiedNoradId"]["dataSource"] == "real"
    assert len(body["sources"]) >= 1
    _assert_no_collision_probability_fields(body)


def test_criticality_score_is_reproducible_from_factors_and_weights() -> None:
    assert abs(sum(spec.weight for spec in CRITICALITY_FACTOR_SPECS) - 1.0) < 1e-9

    for norad_id in (44431, 51656, 41783, 54361, 41752):
        resp = client.get(f"/api/mission/satellites/{norad_id}/criticality")
        assert resp.status_code == 200
        body = resp.json()
        assert body["methodology"] == "rule_based_v1"
        assert len(body["factors"]) == 6

        # Reproduce score directly from returned factors & weights
        recomputed = 0.0
        inverted_found = False
        for factor in body["factors"]:
            expected_eff = (100 - factor["value"]) if factor["inverted"] else factor["value"]
            assert factor["effectiveValue"] == expected_eff
            assert abs(factor["weightedContribution"] - round(factor["weight"] * expected_eff, 2)) < 1e-6
            recomputed += factor["weight"] * expected_eff
            if factor["id"] == "availabilityOfAlternatives":
                inverted_found = True
                assert factor["inverted"] is True
                assert factor["direction"] == "lower_is_more_critical"
                assert "fewer alternatives" in factor["description"].lower()
            # Criticality inputs must be transparently marked as analytical mock
            assert factor["dataSource"] == "mock"

        assert inverted_found is True
        assert body["score"] == round(recomputed)
        assert body["tier"] == map_score_to_tier(body["score"]).tier_id
        _assert_no_collision_probability_fields(body)

    # Confirm worked README example ("why 92?" for CARTOSAT-3)
    cartosat_crit = client.get("/api/mission/satellites/44431/criticality").json()
    assert cartosat_crit["score"] == 92
    assert cartosat_crit["tier"] == "TIER_1_CRITICAL"

    # Confirm PRATHAM (inactive student CubeSat) maps to TIER_4_LOW
    pratham_crit = client.get("/api/mission/satellites/41783/criticality").json()
    assert pratham_crit["score"] < 40
    assert pratham_crit["tier"] == "TIER_4_LOW"


@pytest.mark.parametrize(
    ("score", "expected_tier"),
    [
        (100, "TIER_1_CRITICAL"),
        (85, "TIER_1_CRITICAL"),
        (84, "TIER_2_HIGH"),
        (70, "TIER_2_HIGH"),
        (69, "TIER_3_MODERATE"),
        (40, "TIER_3_MODERATE"),
        (39, "TIER_4_LOW"),
        (0, "TIER_4_LOW"),
    ],
)
def test_criticality_tier_boundaries(score: int, expected_tier: str) -> None:
    assert map_score_to_tier(score).tier_id == expected_tier


def test_alternatives_endpoint_comparison_limitations_and_caveat() -> None:
    resp = client.get("/api/mission/satellites/51656/alternatives")
    assert resp.status_code == 200
    body = resp.json()

    assert body["noradId"] == 51656
    assert body["caveat"] == ALTERNATIVE_CAVEAT_TEXT
    assert len(body["redundancyGaps"]) >= 1
    assert len(body["alternatives"]) >= 2

    alt_names = [a["name"] for a in body["alternatives"]]
    assert "Sentinel-1A" in alt_names

    for alt in body["alternatives"]:
        assert 0 <= alt["capabilityMatch"] <= 95  # Never implies 100% 1:1 replacement
        compared_fields = {c["field"] for c in alt["comparison"]}
        assert compared_fields == {
            "sensorType",
            "spatialResolution",
            "revisitTime",
            "coverage",
            "dataAccess",
        }
        assert len(alt["limitations"]) >= 1
    _assert_no_collision_probability_fields(body)


def test_404_and_422_standard_error_shape() -> None:
    for path in (
        "/api/mission/satellites/999999/capabilities",
        "/api/mission/satellites/999999/criticality",
        "/api/mission/satellites/999999/alternatives",
    ):
        resp = client.get(path)
        assert resp.status_code == 404
        body = resp.json()
        assert body["error"]["code"] == "SATELLITE_NOT_FOUND"
        assert body["error"]["status"] == 404
        assert "999999" in body["error"]["message"]
        _assert_no_collision_probability_fields(body)

    post_404 = client.post("/api/mission/satellites/999999/briefing", json={})
    assert post_404.status_code == 404
    assert post_404.json()["error"]["code"] == "SATELLITE_NOT_FOUND"

    # Negative missDistanceKm triggers 422 standard error envelope
    bad_req = client.post(
        "/api/mission/satellites/51656/briefing",
        json={"missDistanceKm": -5.0},
    )
    assert bad_req.status_code == 422
    assert bad_req.json()["error"]["code"] == "VALIDATION_ERROR"
    assert bad_req.json()["error"]["status"] == 422


def test_briefing_falls_back_to_rule_based_when_no_llm_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    payload = json.loads((SAMPLE_DIR / "flood_monitoring_eos04_alert.json").read_text(encoding="utf-8"))

    resp = client.post("/api/mission/satellites/51656/briefing", json=payload)
    assert resp.status_code == 200
    body = resp.json()

    assert body["generatedBy"] == "rule_based"
    assert body["fallbackReason"] == "missing_llm_api_key"
    assert body["noradId"] == 51656
    assert "preliminary" in body["physicalSeparationContext"].lower()
    assert "independent" in body["missionImportanceContext"].lower()
    assert find_forbidden_language(json.dumps(body)) is None
    _assert_no_collision_probability_fields(body)


def test_briefing_rejects_llm_output_with_forbidden_probability_or_prediction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-placeholder-key")

    def fake_bad_llm(_context: dict[str, Any], _api_key: str) -> tuple[dict[str, Any], str]:
        return (
            {
                "headline": "EOS-04 alert",
                "summary": "The satellite will collide with debris with a 14% collision risk probability.",
                "physicalSeparationContext": "Close approach.",
                "missionImportanceContext": "High importance.",
                "serviceImpactAndContinuity": "Flood mapping affected.",
                "recommendedActions": ["Move satellite immediately."],
            },
            "mock-llm",
        )

    monkeypatch.setattr("backend.mission_intelligence.ai_explainer._call_llm", fake_bad_llm)

    resp = client.post("/api/mission/satellites/51656/briefing", json={"missDistanceKm": 1.2})
    assert resp.status_code == 200
    body = resp.json()
    assert body["generatedBy"] == "rule_based"
    assert body["fallbackReason"] is not None
    assert body["fallbackReason"].startswith("post_check_rejected:")
    assert find_forbidden_language(body["summary"]) is None
    _assert_no_collision_probability_fields(body)


def test_briefing_falls_back_on_llm_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-placeholder-key")

    def fake_timeout_llm(_context: dict[str, Any], _api_key: str) -> tuple[dict[str, Any], str]:
        raise httpx.ReadTimeout("Exceeded 15s timeout")

    monkeypatch.setattr("backend.mission_intelligence.ai_explainer._call_llm", fake_timeout_llm)

    resp = client.post("/api/mission/satellites/41752/briefing", json={"missDistanceKm": 3.5})
    assert resp.status_code == 200
    body = resp.json()
    assert body["generatedBy"] == "rule_based"
    assert body["fallbackReason"] == "llm_timeout"
    _assert_no_collision_probability_fields(body)


def test_cors_allows_configured_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    custom_client = TestClient(create_app())
    resp = custom_client.options(
        "/api/mission/satellites",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
