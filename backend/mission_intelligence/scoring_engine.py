"""Deterministic, Explainable Mission Criticality Engine (methodology: rule_based_v1).

Scientific & architectural guarantees:
- Completely independent of orbital telemetry (miss distance, TCA, relative velocity).
- Tier mapping and factor weights live in config.py (single source of truth).
- The score (0-100 integer) is strictly reproducible from the returned factors and weights:
      score = round(sum(factor.weight * factor.effectiveValue))
  where effectiveValue = (100 - factor.value) when factor.inverted is True, else factor.value.
"""

from __future__ import annotations

from .config import (
    CRITICALITY_FACTOR_SPECS,
    CRITICALITY_METHODOLOGY,
    CRITICALITY_TIER_CONFIG,
    map_score_to_tier,
)
from .schemas import (
    CriticalityFactorBreakdown,
    CriticalityFactorInput,
    CriticalityResponse,
    CriticalitySummary,
    SatelliteRecord,
)


def compute_criticality(satellite: SatelliteRecord) -> CriticalityResponse:
    """Compute a deterministic rule_based_v1 criticality score from mission factors only."""
    inputs = satellite.criticalityInputs
    factors: list[CriticalityFactorBreakdown] = []
    weighted_sum = 0.0

    for spec in CRITICALITY_FACTOR_SPECS:
        raw_input: CriticalityFactorInput = getattr(inputs, spec.factor_id)
        raw_val = int(raw_input.value)
        effective_val = (100 - raw_val) if spec.inverted else raw_val
        contribution = round(spec.weight * effective_val, 2)
        weighted_sum += spec.weight * effective_val

        # Ensure the description clearly states the direction for frontend labeling
        description = raw_input.description
        if spec.inverted and "fewer alternatives" not in description.lower():
            description = f"Fewer alternatives, higher criticality (inverted). {description}"

        factors.append(
            CriticalityFactorBreakdown(
                id=spec.factor_id,
                name=spec.name,
                value=raw_val,
                effectiveValue=effective_val,
                weight=spec.weight,
                weightedContribution=contribution,
                inverted=spec.inverted,
                direction=spec.direction,  # type: ignore[arg-type]
                description=description,
                dataSource=raw_input.dataSource,
                sourceNote=raw_input.sourceNote,
            )
        )

    score = max(0, min(100, int(round(weighted_sum))))
    tier_def = map_score_to_tier(score)

    formula_terms = " + ".join(
        f"{spec.weight:.2f} × {'(100 - ' + spec.factor_id + ')' if spec.inverted else spec.factor_id}"
        for spec in CRITICALITY_FACTOR_SPECS
    )
    tier_thresholds = {
        t.tier_id: f"{t.min_score}-{t.max_score}" for t in CRITICALITY_TIER_CONFIG
    }

    return CriticalityResponse(
        noradId=satellite.noradId,
        verifiedNoradId=satellite.verifiedNoradId,
        name=satellite.name,
        operator=satellite.operator,
        category=satellite.category,
        score=score,
        tier=tier_def.tier_id,  # type: ignore[arg-type]
        tierLabel=tier_def.label,
        methodology=CRITICALITY_METHODOLOGY,
        formula=f"score = round({formula_terms})",
        tierThresholds=tier_thresholds,
        factors=factors,
        supportedServices=satellite.supportedServices,
        dataSource=satellite.dataSource,
    )


def compute_criticality_summary(satellite: SatelliteRecord) -> CriticalitySummary:
    """Return compact criticality summary for catalog list responses."""
    full = compute_criticality(satellite)
    return CriticalitySummary(
        score=full.score,
        tier=full.tier,
        tierLabel=full.tierLabel,
        methodology=full.methodology,
    )
