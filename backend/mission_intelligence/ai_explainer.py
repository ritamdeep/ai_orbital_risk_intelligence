"""Scientifically Guarded AI Briefing Generator for ASTRAVIGIL (Member 3).

Strict rules:
- Uses an LLM ONLY to write natural-language explanations from structured data.
- API key comes strictly from LLM_API_KEY env var (never committed).
- Enforces a 15-second HTTP timeout (LLM_TIMEOUT_SECONDS).
- If LLM_API_KEY is missing, the call fails, times out, or fails the post-check filter,
  returns a deterministic rule-based briefing with generatedBy="rule_based".
- Post-check rejects any LLM text mentioning collision probability, "will collide",
  or collision-risk percentages.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import httpx

from .config import LLM_TIMEOUT_SECONDS, get_llm_api_key, get_llm_provider
from .schemas import (
    AlternativesResponse,
    BriefingRequest,
    BriefingResponse,
    CriticalityResponse,
    SatelliteRecord,
)

SCIENTIFIC_NOTICE = (
    "Preliminary orbital screening relies on public orbital elements and is not a validated "
    "Conjunction Data Message (CDM). Physical separation and mission importance are separate "
    "dimensions: mission criticality guides operator review priority and does not alter orbital "
    "mechanics. Public catalogs track catalogued space objects and cannot individually monitor "
    "smaller untracked debris fragments. This briefing supports operator decision-making and "
    "does not predict collisions."
)

# Strict post-check patterns that MUST trigger fallback rejection if found in LLM output
FORBIDDEN_OUTPUT_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bprobabilit(?:y|ies)\b", re.IGNORECASE),
    re.compile(r"\bwill\s+collide\b", re.IGNORECASE),
    re.compile(r"\bgoing\s+to\s+collide\b", re.IGNORECASE),
    re.compile(r"\bcertain\s+to\s+collide\b", re.IGNORECASE),
    re.compile(r"\bguaranteed\s+(?:collision|impact)\b", re.IGNORECASE),
    re.compile(r"\bwill\s+(?:hit|strike|destroy)\b", re.IGNORECASE),
    re.compile(
        r"\b\d+(?:\.\d+)?\s*%\s*(?:chance|risk|likelihood|collision|impact)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:collision|impact)\s+(?:risk|chance|likelihood)\s*(?:of|is|:)?\s*\d+(?:\.\d+)?\s*%",
        re.IGNORECASE,
    ),
)

BRIEFING_SYSTEM_PROMPT = """You are ASTRAVIGIL's Mission Intelligence Briefing Assistant for satellite operators and disaster-management teams.

MANDATORY CONSTRAINTS:
1. Use ONLY the verified structured JSON data provided in the user prompt. Do NOT invent orbital telemetry, sensor resolutions, operational statuses, or replacement costs.
2. NEVER predict a collision. NEVER state "will collide" or imply a collision is certain.
3. NEVER state, estimate, or mention any collision probability or percentage chance of collision (do not even use the word "probability").
4. Clearly separate "physical separation" (miss distance, relative velocity, TCA — preliminary screening only) from "mission importance" (criticality score, Earth services). Explicitly state that screening is preliminary.
5. Note that alternative satellites have limitations and are not automatic one-to-one replacements.

Respond ONLY with valid JSON containing these exact keys:
- headline (string)
- summary (string)
- physicalSeparationContext (string)
- missionImportanceContext (string)
- serviceImpactAndContinuity (string)
- recommendedActions (array of 3 to 5 concise strings)
"""


def find_forbidden_language(text: str) -> Optional[str]:
    """Return the matched forbidden pattern string if text violates guardrails, else None."""
    for pattern in FORBIDDEN_OUTPUT_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0)
    return None


def validate_briefing_fields(fields: dict[str, Any]) -> Optional[str]:
    """Check all generated text fields against scientific post-check guardrails."""
    parts: list[str] = [
        str(fields.get("headline", "")),
        str(fields.get("summary", "")),
        str(fields.get("physicalSeparationContext", "")),
        str(fields.get("missionImportanceContext", "")),
        str(fields.get("serviceImpactAndContinuity", "")),
    ]
    actions = fields.get("recommendedActions", [])
    if isinstance(actions, list):
        parts.extend(str(a) for a in actions)
    return find_forbidden_language("\n".join(parts))


def _build_rule_based_briefing(
    satellite: SatelliteRecord,
    criticality: CriticalityResponse,
    alternatives: AlternativesResponse,
    request: BriefingRequest,
    *,
    fallback_reason: str,
) -> BriefingResponse:
    """Deterministic, zero-dependency operator briefing that always passes post-check guardrails."""
    sec_name = request.secondaryName or "catalogued space object"
    has_conjunction = request.missDistanceKm is not None or request.tcaUtc is not None

    if has_conjunction:
        miss_str = (
            f"{request.missDistanceKm:.2f} km"
            if request.missDistanceKm is not None
            else "unspecified preliminary separation"
        )
        vel_str = (
            f" at {request.relativeVelocityKms:.2f} km/s relative velocity"
            if request.relativeVelocityKms is not None
            else ""
        )
        tca_str = f" near TCA {request.tcaUtc}" if request.tcaUtc else ""
        headline = (
            f"{satellite.name} (NORAD {satellite.noradId}) — Preliminary {miss_str} close-approach "
            f"review | Mission Criticality {criticality.score}/100 ({criticality.tier})"
        )
        physical_ctx = (
            f"Physical separation (preliminary screening only): Screening reports a closest-approach "
            f"separation of {miss_str}{vel_str} relative to {sec_name} "
            f"({request.secondaryObjectType or 'DEBRIS'}){tca_str}. This is preliminary geometry from "
            f"public orbital elements ({request.orbitalDataSource or 'mock'} data), not a validated "
            "Conjunction Data Message (CDM), and does not indicate that an impact is expected."
        )
    else:
        headline = (
            f"{satellite.name} (NORAD {satellite.noradId}) — Mission Importance & Continuity Brief "
            f"| Criticality {criticality.score}/100 ({criticality.tier})"
        )
        physical_ctx = (
            "Physical separation: No live close-approach geometry was supplied in this request. "
            "Any orbital proximity screening must be evaluated separately from mission importance using "
            "preliminary orbital propagation followed by validated Conjunction Data Messages (CDMs)."
        )

    top_factors = sorted(
        criticality.factors, key=lambda f: f.weightedContribution, reverse=True
    )[:3]
    factor_summary = "; ".join(
        f"{f.name} (raw {f.value}/100"
        + (f", inverted effective {f.effectiveValue}/100" if f.inverted else "")
        + f", weight {int(f.weight * 100)}%)"
        for f in top_factors
    )
    hazard_clause = (
        f" Active terrestrial context noted: {request.activeHazardContext}."
        if request.activeHazardContext
        else ""
    )

    mission_ctx = (
        f"Mission importance (independent of orbital geometry): {satellite.name} ({satellite.operator}, "
        f"status: {satellite.status}) scores {criticality.score}/100 ({criticality.tier}) under "
        f"{criticality.methodology}. Top weighted drivers are {factor_summary}.{hazard_clause}"
    )

    service_names = ", ".join(s.name for s in satellite.supportedServices) or "documented research tasks"
    if alternatives.alternatives:
        top_alts = "; ".join(
            f"{a.name} ({a.operator}, capability match {a.capabilityMatch}/100)"
            for a in alternatives.alternatives[:3]
        )
        gap_note = alternatives.redundancyGaps[0] if alternatives.redundancyGaps else alternatives.caveat
        continuity_ctx = (
            f"If {satellite.name} experienced service degradation or temporary unavailability, supported "
            f"Earth services ({service_names}) could face observation gaps. Highest-overlap alternatives "
            f"in catalog: {top_alts}. Key redundancy gap: {gap_note} {alternatives.caveat}"
        )
    else:
        continuity_ctx = (
            f"If {satellite.name} experienced service degradation or unavailability, supported services "
            f"({service_names}) have no direct catalogued backup. {alternatives.caveat}"
        )

    summary = (
        f"{satellite.name} carries a {criticality.tier} mission importance score ({criticality.score}/100) "
        f"supporting {service_names}. Keeping physical separation distinct from mission importance, "
        "operators should verify any preliminary screening through validated CDM channels while "
        "reviewing partial continuity options and documented sensor/access limitations."
    )

    actions = [
        "Verify preliminary orbital screening with a validated Conjunction Data Message (CDM) from operational space-surveillance authorities (e.g., ISRO NETRA or 18th SDS) before planning any maneuver.",
        f"Review updated public orbital elements for {satellite.name} and {sec_name} as TCA approaches.",
        f"Brief downstream stakeholders relying on {service_names} on potential scheduling adjustments if precautionary safing or maneuvering is later validated.",
    ]
    if alternatives.alternatives:
        top_alt = alternatives.alternatives[0]
        actions.append(
            f"Evaluate partial continuity workflows with {top_alt.name} ({top_alt.operator}, match {top_alt.capabilityMatch}/100), accounting for documented resolution, revisit, and access limitations."
        )

    return BriefingResponse(
        noradId=satellite.noradId,
        verifiedNoradId=satellite.verifiedNoradId,
        satelliteName=satellite.name,
        conjunctionId=request.conjunctionId,
        generatedBy="rule_based",
        fallbackReason=fallback_reason,
        model=None,
        headline=headline,
        summary=summary,
        physicalSeparationContext=physical_ctx,
        missionImportanceContext=mission_ctx,
        serviceImpactAndContinuity=continuity_ctx,
        recommendedActions=actions,
        criticalityScore=criticality.score,
        criticalityTier=criticality.tier,
        scientificNotice=SCIENTIFIC_NOTICE,
        dataSource=satellite.dataSource,
    )


def _call_llm(context: dict[str, Any], api_key: str) -> tuple[dict[str, Any], str]:
    """Call configured LLM provider with strict 15-second timeout and return parsed JSON + model name."""
    provider = get_llm_provider()
    timeout = httpx.Timeout(LLM_TIMEOUT_SECONDS)

    if provider == "openai":
        model_name = os.getenv("LLM_MODEL", "").strip() or "gpt-4o-mini"
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        payload = {
            "model": model_name,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": BRIEFING_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Structured ASTRAVIGIL data:\n{json.dumps(context, indent=2)}",
                },
            ],
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{base_url}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            raw_text = resp.json()["choices"][0]["message"]["content"]
    else:
        model_name = os.getenv("LLM_MODEL", "").strip() or "gemini-2.0-flash"
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_name}:generateContent?key={api_key}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": BRIEFING_SYSTEM_PROMPT}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": f"Structured ASTRAVIGIL data:\n{json.dumps(context, indent=2)}"
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    parsed = json.loads(cleaned)
    return parsed, model_name


def generate_briefing(
    satellite: SatelliteRecord,
    criticality: CriticalityResponse,
    alternatives: AlternativesResponse,
    request: BriefingRequest,
) -> BriefingResponse:
    """Generate a natural-language operator briefing with strict LLM guardrails & fallback."""
    api_key = get_llm_api_key()
    if not api_key:
        return _build_rule_based_briefing(
            satellite,
            criticality,
            alternatives,
            request,
            fallback_reason="missing_llm_api_key",
        )

    context = {
        "satellite": {
            "noradId": satellite.noradId,
            "name": satellite.name,
            "operator": satellite.operator,
            "category": satellite.category,
            "status": satellite.status,
            "missionSummary": satellite.missionSummary,
            "capabilities": satellite.capabilities.model_dump(),
            "supportedServices": [s.model_dump() for s in satellite.supportedServices],
        },
        "missionCriticality": {
            "score": criticality.score,
            "tier": criticality.tier,
            "methodology": criticality.methodology,
            "factors": [
                {
                    "name": f.name,
                    "value": f.value,
                    "effectiveValue": f.effectiveValue,
                    "weight": f.weight,
                    "inverted": f.inverted,
                }
                for f in criticality.factors
            ],
        },
        "physicalScreeningContext": request.model_dump(exclude_none=True),
        "alternatives": [
            {
                "name": a.name,
                "operator": a.operator,
                "capabilityMatch": a.capabilityMatch,
                "limitations": a.limitations[:3],
            }
            for a in alternatives.alternatives[:3]
        ],
        "redundancyGaps": alternatives.redundancyGaps,
        "caveat": alternatives.caveat,
    }

    try:
        llm_fields, model_name = _call_llm(context, api_key)
    except httpx.TimeoutException:
        return _build_rule_based_briefing(
            satellite,
            criticality,
            alternatives,
            request,
            fallback_reason="llm_timeout",
        )
    except Exception:
        return _build_rule_based_briefing(
            satellite,
            criticality,
            alternatives,
            request,
            fallback_reason="llm_error",
        )

    # Mandatory post-check: reject forbidden collision-probability or prediction claims
    violation = validate_briefing_fields(llm_fields)
    if violation is not None:
        return _build_rule_based_briefing(
            satellite,
            criticality,
            alternatives,
            request,
            fallback_reason=f"post_check_rejected:{violation}",
        )

    try:
        return BriefingResponse(
            noradId=satellite.noradId,
            verifiedNoradId=satellite.verifiedNoradId,
            satelliteName=satellite.name,
            conjunctionId=request.conjunctionId,
            generatedBy="llm",
            fallbackReason=None,
            model=model_name,
            headline=str(llm_fields["headline"]),
            summary=str(llm_fields["summary"]),
            physicalSeparationContext=str(llm_fields["physicalSeparationContext"]),
            missionImportanceContext=str(llm_fields["missionImportanceContext"]),
            serviceImpactAndContinuity=str(llm_fields["serviceImpactAndContinuity"]),
            recommendedActions=[str(a) for a in llm_fields["recommendedActions"]],
            criticalityScore=criticality.score,
            criticalityTier=criticality.tier,
            scientificNotice=SCIENTIFIC_NOTICE,
            dataSource=satellite.dataSource,
        )
    except Exception:
        return _build_rule_based_briefing(
            satellite,
            criticality,
            alternatives,
            request,
            fallback_reason="llm_schema_invalid",
        )
