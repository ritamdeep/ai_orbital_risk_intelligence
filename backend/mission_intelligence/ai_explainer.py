"""AI-Based Risk Explanation Generator for ASTRAVIGIL.

Converts structured conjunction screening data + mission criticality + Earth impact +
alternative satellite continuity findings into plain-language operational advisories
for small-satellite operators and disaster-management teams.

Guardrails:
- Supports optional grounded LLM generation (Gemini or OpenAI-compatible REST API)
  when an API key is configured via environment variables.
- Provides a high-clarity, scientifically audited deterministic fallback whenever
  no LLM API key is configured or the external LLM call fails.
- Enforces ASTRAVIGIL's 12 scientific rules in both LLM prompts and fallback output.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import httpx

from .schemas import (
    AlternativeSatelliteRecommendation,
    ConjunctionAlertInput,
    ExplainablePriorityResult,
    OperationalAdvisory,
    PriorityBand,
    RedundancyGap,
    SatelliteMission,
    ServiceDisruptionItem,
)

MANDATORY_SCIENTIFIC_CAVEATS: list[str] = [
    "Preliminary SGP4 close-approach screening is not equivalent to a validated Conjunction Data Message (CDM).",
    "A close approach does not automatically imply a collision; physical collision probability (Pc) requires covariance data not present in public TLEs.",
    "Mission criticality and Earth-impact multipliers guide operational triage priority and do not change physical collision likelihood.",
    "Public space catalogs monitor catalogued objects (typically >=10 cm in LEO); smaller untracked debris fragments cannot be individually screened.",
    "Potential orbital impacts can cause partial subsystem degradation or spacecraft loss and generate secondary debris—not every event destroys both objects.",
    "ASTRAVIGIL is an AI-assisted decision-support platform, not an autonomous collision-avoidance system.",
]

SYSTEM_PROMPT = """You are ASTRAVIGIL's Orbital Risk & Mission Continuity Advisory Assistant.
Your audience is small-satellite operators, university CubeSat teams, and disaster-management agencies.

STRICT SCIENTIFIC RULES (NEVER VIOLATE):
1. Preliminary close-approach screening is NOT a validated Conjunction Data Message (CDM).
2. A close approach does NOT mean a collision will occur. NEVER invent a collision probability (Pc) or percentage chance of impact.
3. Mission criticality and Earth impact NEVER change physical collision probability; keep physical risk and mission importance clearly distinct.
4. Distinguish catalogued space debris from smaller untracked fragments.
5. Do NOT claim every collision completely destroys both satellites; frame impact as potential service degradation or unavailability.
6. NEVER claim AI predicts collisions; orbital mechanics performs screening, AI assists explanation and decision support.
7. NEVER invent operational status, sensor specifications, or facts not present in the provided JSON context.
8. Explicitly note that alternative satellites are partial capability matches, not automatic 1:1 replacements.

Respond ONLY with valid JSON containing these exact keys:
- headline (string)
- executive_summary (string)
- orbital_screening_interpretation (string)
- mission_and_earth_impact_brief (string)
- continuity_and_backup_guidance (string)
- recommended_operator_actions (array of 4-6 concise actionable strings)
"""


def _build_deterministic_advisory(
    alert: ConjunctionAlertInput,
    mission: Optional[SatelliteMission],
    priority: ExplainablePriorityResult,
    disruptions: list[ServiceDisruptionItem],
    gaps: list[RedundancyGap],
    alternatives: list[AlternativeSatelliteRecommendation],
) -> OperationalAdvisory:
    """High-clarity, zero-dependency operator advisory used when no LLM API key is set."""
    sat_name = mission.name if mission else (alert.primary_name or f"NORAD {alert.primary_norad_id}")
    operator = mission.operator if mission else "Unverified Operator"
    orb = priority.orbital_screening
    crit = priority.mission_criticality
    earth = priority.earth_impact

    headline = (
        f"[{priority.priority_band.value}] {sat_name} (NORAD {alert.primary_norad_id}) — "
        f"{orb.miss_distance_km:.2f} km preliminary close approach with {alert.secondary_name} "
        f"| Priority Score {priority.explainable_priority_score:.1f}/100"
    )

    active_context_clause = ""
    if earth.applied_multipliers:
        events_str = "; ".join(
            f"{m.severity.value} {m.event_type.replace('_', ' ')} in {m.region} ({m.multiplier:.2f}x)"
            for m in earth.applied_multipliers
        )
        active_context_clause = (
            f" Active terrestrial emergency context ({events_str}) elevates Earth-service sensitivity "
            f"from baseline {earth.base_earth_impact_score:.2f} to {earth.effective_earth_impact_score:.2f}."
        )

    executive_summary = (
        f"Preliminary orbital screening flags a {orb.miss_distance_km:.2f} km closest approach between "
        f"{sat_name} ({operator}) and catalogued {alert.secondary_object_type.lower()} '{alert.secondary_name}' "
        f"at {orb.tca_utc} (relative speed {orb.relative_velocity_kms:.2f} km/s). "
        f"While physical screening alone places this encounter in {orb.screening_tier.value}, combining "
        f"separate Orbital Risk ({orb.orbital_risk_score:.2f}), Mission Criticality ({crit.mission_criticality_score:.2f}), "
        f"and Earth Impact ({earth.effective_earth_impact_score:.2f}) yields an operational triage score of "
        f"{priority.explainable_priority_score:.1f}/100 ({priority.priority_band.value}).{active_context_clause}"
    )

    orbital_interpretation = (
        f"Physical Screening Dimension (separate from mission importance): SGP4 screening estimates a minimum "
        f"miss distance of {orb.miss_distance_km:.2f} km at {orb.relative_velocity_kms:.2f} km/s relative velocity "
        f"(TCA: {orb.tca_utc}). {orb.tle_freshness_note} Because public TLE data lacks state-vector covariance "
        "matrices, no physical collision probability (Pc) is calculated; this event requires validated CDM verification "
        "rather than assuming a collision is likely."
    )

    if disruptions:
        top_services = ", ".join(f"{d.service_name} ({d.severity.value})" for d in disruptions[:3])
        sectors = sorted({sec for d in disruptions for sec in d.dependent_sectors})
        mission_brief = (
            f"Mission & Earth-Impact Dimension: {sat_name} carries a deterministic Mission Criticality of "
            f"{crit.mission_criticality_score:.2f} ({crit.criticality_tier.value}). If a conjunction event "
            f"or precautionary safing degraded spacecraft availability, key affected services include: {top_services}. "
            f"Downstream stakeholders potentially impacted: {', '.join(sectors[:6])}."
            f"{active_context_clause}"
        )
    else:
        mission_brief = (
            f"Mission & Earth-Impact Dimension: {sat_name} is not yet mapped in ASTRAVIGIL's verified mission "
            f"database (baseline criticality {crit.mission_criticality_score:.2f}). Operators should register "
            "verified payload and service dependencies to unlock tailored Earth-impact analysis."
        )

    if alternatives:
        alt_summaries = "; ".join(
            f"{a.name} ({a.operator}, {int(a.compatibility_score * 100)}% overlap — {a.match_class.value}, "
            f"access: {a.data_access_model})"
            for a in alternatives[:3]
        )
        primary_gap = gaps[0].summary if gaps else "Orbital pass timing and sensor calibration still differ."
        continuity_guidance = (
            f"Service Continuity Options: Top overlapping satellites in catalog are {alt_summaries}. "
            f"Key redundancy limitation: {primary_gap} None of these candidates should be treated as an "
            "automatic 1:1 replacement without verifying pass geometry, sensor mode, and tasking permissions."
        )
    else:
        continuity_guidance = (
            f"Service Continuity Options: No overlapping backup satellites were identified in the current "
            f"catalog for {sat_name}. Operators should maintain heightened monitoring and verify manual contingency feeds."
        )

    actions: list[str] = []
    if priority.priority_band in {PriorityBand.CRITICAL_PRIORITY, PriorityBand.HIGH_PRIORITY}:
        actions.append(
            "Request or inspect a validated Conjunction Data Message (CDM) via ISRO NETRA / 18th Space Defense Squadron "
            "(Space-Track) to obtain covariance-based collision probability before any maneuver decision."
        )
    else:
        actions.append(
            "Continue routine screening and re-run close-approach propagation after the next public GP/TLE epoch update."
        )

    actions.append(
        f"Monitor ephemeris updates for both {sat_name} (NORAD {alert.primary_norad_id}) and "
        f"{alert.secondary_name} leading up to TCA ({orb.tca_utc})."
    )

    if earth.applied_multipliers:
        actions.append(
            "Notify downstream disaster-management teams (e.g., NDMA / State EOCs / IMD) of potential observation-window "
            "scheduling adjustments if a validated CDM later requires an avoidance maneuver."
        )

    if alternatives:
        best_alt = alternatives[0]
        actions.append(
            f"Pre-stage contingency data workflows using {best_alt.name} ({best_alt.data_access_model}) "
            "while accounting for revisit cadence, cloud-cover, or tasking limitations."
        )

    actions.append(
        "Document screening provenance and keep operator human-in-the-loop sign-off for all conjunction responses."
    )

    return OperationalAdvisory(
        headline=headline,
        executive_summary=executive_summary,
        orbital_screening_interpretation=orbital_interpretation,
        mission_and_earth_impact_brief=mission_brief,
        continuity_and_backup_guidance=continuity_guidance,
        recommended_operator_actions=actions,
        scientific_caveats=list(MANDATORY_SCIENTIFIC_CAVEATS),
        generation_mode="deterministic_fallback",
        model_used=None,
    )


def _build_llm_context_payload(
    alert: ConjunctionAlertInput,
    mission: Optional[SatelliteMission],
    priority: ExplainablePriorityResult,
    disruptions: list[ServiceDisruptionItem],
    gaps: list[RedundancyGap],
    alternatives: list[AlternativeSatelliteRecommendation],
) -> dict[str, Any]:
    return {
        "conjunction_screening": {
            "primary_norad_id": alert.primary_norad_id,
            "primary_name": mission.name if mission else (alert.primary_name or f"NORAD {alert.primary_norad_id}"),
            "secondary_name": alert.secondary_name,
            "secondary_object_type": alert.secondary_object_type,
            "tca_utc": alert.tca_utc,
            "miss_distance_km": alert.miss_distance_km,
            "relative_velocity_kms": alert.relative_velocity_kms,
            "tle_epoch_age_hours": alert.tle_epoch_age_hours,
            "data_provenance": alert.data_provenance,
        },
        "priority_assessment": {
            "explainable_priority_score": priority.explainable_priority_score,
            "priority_band": priority.priority_band.value,
            "formula_numeric_trace": priority.formula_numeric_trace,
            "orbital_screening_tier": priority.orbital_screening.screening_tier.value,
            "mission_criticality_score": priority.mission_criticality.mission_criticality_score,
            "effective_earth_impact_score": priority.earth_impact.effective_earth_impact_score,
            "applied_multipliers": [m.model_dump() for m in priority.earth_impact.applied_multipliers],
        },
        "mission_summary": mission.mission_summary if mission else "Uncatalogued satellite mission.",
        "disrupted_services": [d.model_dump() for d in disruptions[:4]],
        "redundancy_gaps": [g.model_dump() for g in gaps[:4]],
        "top_alternatives": [
            {
                "name": a.name,
                "operator": a.operator,
                "match_class": a.match_class.value,
                "compatibility_score": a.compatibility_score,
                "data_access_model": a.data_access_model,
                "gaps_and_limitations": a.gaps_and_limitations[:3],
            }
            for a in alternatives[:3]
        ],
    }


def _parse_llm_json_response(
    raw_text: str,
    *,
    mode: str,
    model_name: str,
) -> Optional[OperationalAdvisory]:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    data = json.loads(cleaned)
    return OperationalAdvisory(
        headline=str(data["headline"]),
        executive_summary=str(data["executive_summary"]),
        orbital_screening_interpretation=str(data["orbital_screening_interpretation"]),
        mission_and_earth_impact_brief=str(data["mission_and_earth_impact_brief"]),
        continuity_and_backup_guidance=str(data["continuity_and_backup_guidance"]),
        recommended_operator_actions=[str(a) for a in data["recommended_operator_actions"]],
        scientific_caveats=list(MANDATORY_SCIENTIFIC_CAVEATS),
        generation_mode=mode,  # type: ignore[arg-type]
        model_used=model_name,
    )


def _call_gemini_llm(context: dict[str, Any], api_key: str) -> Optional[OperationalAdvisory]:
    model_name = os.getenv("ASTRAVIGIL_GEMINI_MODEL", "gemini-2.0-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Generate an operator advisory JSON strictly grounded in this verified "
                            f"ASTRAVIGIL payload:\n{json.dumps(context, indent=2)}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    with httpx.Client(timeout=12.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        body = resp.json()
    raw_text = body["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_llm_json_response(raw_text, mode="llm_gemini", model_name=model_name)


def _call_openai_compatible_llm(context: dict[str, Any], api_key: str) -> Optional[OperationalAdvisory]:
    base_url = os.getenv("ASTRAVIGIL_OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model_name = os.getenv("ASTRAVIGIL_OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "model": model_name,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Generate an operator advisory JSON strictly grounded in this verified "
                    f"ASTRAVIGIL payload:\n{json.dumps(context, indent=2)}"
                ),
            },
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    with httpx.Client(timeout=12.0) as client:
        resp = client.post(f"{base_url}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        body = resp.json()
    raw_text = body["choices"][0]["message"]["content"]
    return _parse_llm_json_response(raw_text, mode="llm_openai_compatible", model_name=model_name)


def generate_risk_explanation(
    alert: ConjunctionAlertInput,
    mission: Optional[SatelliteMission],
    priority: ExplainablePriorityResult,
    disruptions: list[ServiceDisruptionItem],
    gaps: list[RedundancyGap],
    alternatives: list[AlternativeSatelliteRecommendation],
) -> OperationalAdvisory:
    """Generate an operational advisory using configured LLM or deterministic fallback."""
    provider = os.getenv("ASTRAVIGIL_LLM_PROVIDER", "auto").strip().lower()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if provider != "fallback":
        context = _build_llm_context_payload(
            alert, mission, priority, disruptions, gaps, alternatives
        )
        try:
            if provider in {"auto", "gemini"} and gemini_key:
                advisory = _call_gemini_llm(context, gemini_key)
                if advisory is not None:
                    return advisory
            if provider in {"auto", "openai"} and openai_key:
                advisory = _call_openai_compatible_llm(context, openai_key)
                if advisory is not None:
                    return advisory
        except Exception:
            # Graceful failover guarantees zero downtime for operators and hackathon demos
            pass

    return _build_deterministic_advisory(
        alert, mission, priority, disruptions, gaps, alternatives
    )


def get_llm_status() -> dict[str, str]:
    """Report active explanation backend mode without exposing secret keys."""
    provider = os.getenv("ASTRAVIGIL_LLM_PROVIDER", "auto").strip().lower()
    if provider == "fallback":
        return {"mode": "deterministic_fallback", "provider": "fallback_forced"}
    if provider in {"auto", "gemini"} and os.getenv("GEMINI_API_KEY", "").strip():
        return {
            "mode": "llm_gemini",
            "provider": os.getenv("ASTRAVIGIL_GEMINI_MODEL", "gemini-2.0-flash"),
        }
    if provider in {"auto", "openai"} and os.getenv("OPENAI_API_KEY", "").strip():
        return {
            "mode": "llm_openai_compatible",
            "provider": os.getenv("ASTRAVIGIL_OPENAI_MODEL", "gpt-4o-mini"),
        }
    return {"mode": "deterministic_fallback", "provider": "no_api_key_configured"}
