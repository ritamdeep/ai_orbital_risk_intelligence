"""Centralized configuration for ASTRAVIGIL Mission Intelligence (Member 3).

Single source of truth for:
- Criticality tier thresholds (TIER_1_CRITICAL .. TIER_4_LOW)
- Criticality factor weights (rule_based_v1)
- CORS origins (CORS_ORIGINS env var, default http://localhost:5173)
- LLM API key, timeout (15s), and output post-check guardrails
- Mandatory alternative-satellite caveat text
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class TierDefinition:
    tier_id: str
    label: str
    min_score: int
    max_score: int


# Single source of truth for criticality tier mapping (Step 4)
CRITICALITY_TIER_CONFIG: tuple[TierDefinition, ...] = (
    TierDefinition(tier_id="TIER_1_CRITICAL", label="Tier 1 Critical", min_score=85, max_score=100),
    TierDefinition(tier_id="TIER_2_HIGH", label="Tier 2 High", min_score=70, max_score=84),
    TierDefinition(tier_id="TIER_3_MODERATE", label="Tier 3 Moderate", min_score=40, max_score=69),
    TierDefinition(tier_id="TIER_4_LOW", label="Tier 4 Low", min_score=0, max_score=39),
)

CRITICALITY_METHODOLOGY = "rule_based_v1"


@dataclass(frozen=True)
class FactorSpec:
    factor_id: str
    name: str
    weight: float
    inverted: bool
    direction: str
    direction_note: str


# Single source of truth for rule_based_v1 weights (sum == 1.00)
CRITICALITY_FACTOR_SPECS: tuple[FactorSpec, ...] = (
    FactorSpec(
        factor_id="disasterMonitoringSupport",
        name="Disaster-monitoring support",
        weight=0.25,
        inverted=False,
        direction="higher_is_more_critical",
        direction_note="Higher score indicates stronger reliance during disasters (floods, cyclones, rapid mapping).",
    ),
    FactorSpec(
        factor_id="uniqueCapability",
        name="Unique capability",
        weight=0.20,
        inverted=False,
        direction="higher_is_more_critical",
        direction_note="Higher score indicates specialized sensor or orbital capability that is hard to replicate.",
    ),
    FactorSpec(
        factor_id="serviceDependency",
        name="Service dependency",
        weight=0.20,
        inverted=False,
        direction="higher_is_more_critical",
        direction_note="Higher score indicates broader downstream operational dependence by public or sector users.",
    ),
    FactorSpec(
        factor_id="availabilityOfAlternatives",
        name="Availability of alternatives",
        weight=0.15,
        inverted=True,
        direction="lower_is_more_critical",
        direction_note=(
            "Inverted scale — fewer alternatives mean higher criticality "
            "(effective criticality contribution uses 100 - raw availability score)."
        ),
    ),
    FactorSpec(
        factor_id="nationalInfrastructureDefence",
        name="National infrastructure and defence value",
        weight=0.10,
        inverted=False,
        direction="higher_is_more_critical",
        direction_note="Higher score indicates higher importance to national infrastructure, sovereignty, or security.",
    ),
    FactorSpec(
        factor_id="commercialScientificValue",
        name="Commercial and scientific value",
        weight=0.10,
        inverted=False,
        direction="higher_is_more_critical",
        direction_note="Higher score indicates higher economic, research, or educational mission value.",
    ),
)

# Canonical caveat always returned by GET /api/mission/satellites/{noradId}/alternatives
ALTERNATIVE_CAVEAT_TEXT = (
    "A satellite with a similar mission category is not automatically a one-to-one operational replacement. "
    "Differences in sensor modality, spatial resolution, orbital revisit timing, geographic coverage, and "
    "data-access or tasking policies must be verified before relying on any alternative."
)

# Canonical capability-match weights (sum == 100)
ALTERNATIVE_MATCH_WEIGHTS: dict[str, int] = {
    "sensorType": 35,
    "spatialResolution": 20,
    "revisitTime": 15,
    "coverage": 15,
    "dataAccess": 15,
}

DEFAULT_PORT = 8001
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "15.0"))


def map_score_to_tier(score: int) -> TierDefinition:
    """Map an integer criticality score (0-100) to its configured tier."""
    clamped = max(0, min(100, int(score)))
    for tier_def in CRITICALITY_TIER_CONFIG:
        if tier_def.min_score <= clamped <= tier_def.max_score:
            return tier_def
    return CRITICALITY_TIER_CONFIG[-1]


def get_cors_origins() -> list[str]:
    """Read allowed CORS origins from CORS_ORIGINS env var (comma-separated)."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173").strip()
    if not raw:
        return ["http://localhost:5173"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_llm_api_key() -> str:
    """Return LLM_API_KEY from environment (never hardcoded or committed)."""
    return os.getenv("LLM_API_KEY", "").strip()


def get_llm_provider() -> str:
    """Return configured LLM provider ('gemini' or 'openai')."""
    return os.getenv("LLM_PROVIDER", "gemini").strip().lower()
