"""Geometric Apogee-Perigee Altitude Filter for Orbital Conjunction Screening.

Filters out satellite pairs whose orbital altitude shells do not overlap,
saving expensive SGP4 time-series propagation.
"""

from typing import Dict, Any, Tuple


def orbits_can_intersect(
    params_a: Dict[str, Any],
    params_b: Dict[str, Any],
    threshold_km: float = 15.0,
    safety_margin_km: float = 30.0,
) -> Tuple[bool, float]:
    """Determine whether two orbits overlap within the altitude threshold plus safety margin.

    Returns:
        can_intersect: True if altitude envelopes overlap within margin, False otherwise.
        altitude_separation_km: Estimated radial distance between shells (negative if overlapping).
    """
    perigee_a = params_a["perigee_km"]
    apogee_a = params_a["apogee_km"]

    perigee_b = params_b["perigee_km"]
    apogee_b = params_b["apogee_km"]

    margin = threshold_km + safety_margin_km

    # Case 1: Orbit A is entirely above Orbit B
    if perigee_a - apogee_b > margin:
        return False, perigee_a - apogee_b

    # Case 2: Orbit B is entirely above Orbit A
    if perigee_b - apogee_a > margin:
        return False, perigee_b - apogee_a

    # Altitude shells overlap
    overlap = max(perigee_a, perigee_b) - min(apogee_a, apogee_b)
    return True, overlap
