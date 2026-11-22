/**
 * ASTRAVIGIL Data Adapters & Normalization Layer
 *
 * Normalizes live responses from both the Orbital Risk Engine (port 8000)
 * and the Mission Intelligence Service (port 8001) into unified frontend types,
 * while maintaining 100% backward compatibility with fallback mock data.
 *
 * Features:
 * - Safe field defaults (no null crashes)
 * - CARTOSAT-3 alias normalization (44431 <-> 44804)
 * - Explicit dataSource ('real' | 'mock') stamping
 * - Dual-property access (e.g. missDistanceKm and miss_distance_km)
 */

import { SatelliteSummaryDto, ConjunctionEventDto } from './orbitalApi';
import {
  MissionSatelliteSummaryDto,
  CapabilitiesResponseDto,
  CriticalityResponseDto,
  AlternativesResponseDto,
  BriefingResponseDto,
} from './missionApi';
import { SpaceObjectSummary, ConjunctionEvent } from '../types/orbital';
import {
  SatelliteMissionProfile,
  OperatorAIBriefing,
  AlternativeSatellite,
  CriticalityAssessment,
  EarthServiceImpact,
} from '../types/intelligence';
import { SatelliteCatalogueItem } from '../types/satelliteIntelligence';
import { formatCriticalityTier, formatEnum, formatOperator } from '../utils/textFormatters';

/** Normalizes NORAD ID for cross-module lookup (Cartosat-3 contract alias) */
export function normalizeNoradId(id: number): number {
  if (id === 44804) return 44431;
  return id;
}

/** Returns all valid NORAD IDs for a satellite entity */
export function getEquivalentNoradIds(id: number): number[] {
  if (id === 44431 || id === 44804) return [44431, 44804];
  return [id];
}

/** Check if two NORAD IDs refer to the same satellite */
export function isSameSatellite(idA: number, idB: number): boolean {
  if (idA === idB) return true;
  if ((idA === 44431 && idB === 44804) || (idA === 44804 && idB === 44431)) return true;
  return false;
}

/**
 * Adapts an Orbital SatelliteSummaryDto into SpaceObjectSummary
 */
export function adaptOrbitalToSpaceObject(dto: SatelliteSummaryDto): SpaceObjectSummary {
  const normId = normalizeNoradId(dto.noradId);
  return {
    norad_id: normId,
    name: dto.name || `Object #${dto.noradId}`,
    intl_designator: dto.intlDesignator || 'N/A',
    object_type: (dto.type?.toUpperCase() || 'UNKNOWN') as any,
    country_code: dto.countryCode || 'UNK',
    orbit_regime: (dto.orbitRegime?.toUpperCase() || 'LEO') as any,
    perigee_km: dto.perigeeKm ?? 500,
    apogee_km: dto.apogeeKm ?? 500,
    inclination_deg: dto.inclinationDeg ?? 0,
    period_min: dto.periodMin ?? 90,
    current_position: {
      latitude: dto.position?.latitude ?? 0,
      longitude: dto.position?.longitude ?? 0,
      altitude_km: dto.position?.altitudeKm ?? dto.perigeeKm ?? 500,
    },
    tle_epoch: dto.tleEpochUtc || new Date().toISOString(),
    is_active: Boolean(dto.isActive),
    dataSource: dto.dataSource || 'mock',
  };
}

/**
 * Adapts a live Orbital ConjunctionEventDto into ConjunctionEvent
 */
export function adaptConjunctionEvent(dto: ConjunctionEventDto): ConjunctionEvent {
  const primaryNormId = normalizeNoradId(dto.primaryObject?.noradId ?? 0);
  const secondaryNormId = normalizeNoradId(dto.secondaryObject?.noradId ?? 0);

  // Compute TLE epoch age in hours safely
  let epochAgeHours = 0;
  try {
    const epochDate = new Date(dto.tleEpochUtc || dto.primaryObject?.tleEpochUtc || Date.now());
    epochAgeHours = Math.max(0, (Date.now() - epochDate.getTime()) / (1000 * 60 * 60));
  } catch {
    epochAgeHours = 2.4;
  }

  const ds = dto.dataSource || 'mock';

  return {
    conjunction_id: dto.eventId || `CONJ-${Date.now()}`,
    eventId: dto.eventId,
    primary_object: {
      norad_id: primaryNormId,
      name: dto.primaryObject?.name || 'Primary Asset',
      object_type: (dto.primaryObject?.type?.toUpperCase() || 'PAYLOAD') as any,
      orbit_regime: (dto.primaryObject?.orbitRegime?.toUpperCase() || 'LEO') as any,
      country_code: dto.primaryObject?.countryCode || 'IND',
    },
    secondary_object: {
      norad_id: secondaryNormId,
      name: dto.secondaryObject?.name || 'Secondary Object',
      object_type: (dto.secondaryObject?.type?.toUpperCase() || 'DEBRIS') as any,
      orbit_regime: (dto.secondaryObject?.orbitRegime?.toUpperCase() || 'LEO') as any,
      country_code: dto.secondaryObject?.countryCode || 'UNK',
      origin_debris_event: dto.screeningNote || undefined,
    },
    tca: dto.tcaUtc || new Date().toISOString(),
    tcaUtc: dto.tcaUtc,
    miss_distance_km: dto.missDistanceKm ?? 99.9,
    missDistanceKm: dto.missDistanceKm,
    relative_velocity_km_s: dto.relativeVelocityKmS ?? 0,
    relativeVelocityKmS: dto.relativeVelocityKmS,
    altitude_at_tca_km: dto.altitudeAtTcaKm ?? 500,
    altitudeAtTcaKm: dto.altitudeAtTcaKm,
    tle_epoch_age_hours: Number(epochAgeHours.toFixed(1)),
    is_preliminary_screening: Boolean(dto.isPreliminaryScreening ?? true),
    investigation_status: (dto.investigationStatus as any) || 'UNREVIEWED',
    dataSource: ds,
    data_source: {
      source_name: ds === 'real' ? 'CelesTrak / SGP4 Live Ephemeris' : 'Sample TLE Seed Data',
      epoch_time: dto.tleEpochUtc || new Date().toISOString(),
      is_mock: ds !== 'real',
      scientific_note: dto.screeningNote || 'Preliminary SGP4 geometric screening.',
    },
  };
}

/**
 * Combines Mission Satellite Record + Orbital Data into SatelliteCatalogueItem
 */
export function adaptToCatalogueItem(
  missionSat: MissionSatelliteSummaryDto,
  orbitalObj?: SpaceObjectSummary | null
): SatelliteCatalogueItem {
  const noradId = normalizeNoradId(missionSat.noradId);
  const rawTier = missionSat.criticality?.tier || 'TIER_1_CRITICAL';
  const tierFormatted = formatCriticalityTier(rawTier);

  // Map category to valid SatelliteCatalogueItem categories
  let category: SatelliteCatalogueItem['category'] = 'Earth Observation';
  if (missionSat.category === 'Disaster Monitoring') category = 'Disaster Monitoring';
  else if (missionSat.category === 'Weather' || missionSat.category === 'Meteorology') category = 'Weather';
  else if (missionSat.category === 'Communication') category = 'Communication';
  else if (missionSat.category === 'Navigation') category = 'Navigation';
  else if (missionSat.category?.includes('Student') || missionSat.category?.includes('Scientific')) {
    category = 'Scientific / Student';
  }

  // Map supported services to icon keys
  const mappedServices = (missionSat.supportedServices || []).map((s) => {
    let icon: 'flood' | 'cyclone' | 'urban' | 'defense' | 'ocean' | 'agriculture' | 'weather' | 'search' = 'flood';
    const lowerName = (s.name + ' ' + (s.sector || '')).toLowerCase();
    if (lowerName.includes('cyclone') || lowerName.includes('storm')) icon = 'cyclone';
    else if (lowerName.includes('urban') || lowerName.includes('cadastral')) icon = 'urban';
    else if (lowerName.includes('ocean') || lowerName.includes('maritime') || lowerName.includes('sea')) icon = 'ocean';
    else if (lowerName.includes('agri') || lowerName.includes('crop') || lowerName.includes('forest')) icon = 'agriculture';
    else if (lowerName.includes('weather') || lowerName.includes('climate')) icon = 'weather';
    else if (lowerName.includes('defence') || lowerName.includes('defense') || lowerName.includes('security')) icon = 'defense';
    else if (lowerName.includes('search') || lowerName.includes('rescue')) icon = 'search';

    return {
      name: s.name,
      icon,
    };
  });

  return {
    id: `sat-${noradId}`,
    name: missionSat.name,
    noradId,
    category,
    categoryChipLabel: missionSat.capabilities?.allWeatherCapable ? 'Radar Imaging' : category,
    orbit: missionSat.orbitRegime || 'LEO',
    orbitSubtype: missionSat.orbitSubtype || `${missionSat.orbitRegime} Orbit`,
    altitudeKm: orbitalObj ? Math.round(orbitalObj.current_position.altitude_km) : 508,
    periodMin: orbitalObj ? Number(orbitalObj.period_min.toFixed(1)) : 94.8,
    inclinationDeg: orbitalObj ? Number(orbitalObj.inclination_deg.toFixed(1)) : 97.5,
    operator: formatOperator(missionSat.operator),
    status: (missionSat.status as any) || 'Operational',
    capabilities: {
      sensorType: missionSat.capabilities?.sensorType || 'Optical / Imaging Sensor',
      spatialResolution: missionSat.capabilities?.spatialResolution || 'Standard Resolution',
      revisitTime: missionSat.capabilities?.revisitTime || 'Few days',
      coverage: missionSat.capabilities?.coverage || 'Global / Regional',
      dataAccess: missionSat.capabilities?.dataAccess || 'Restricted / Government',
    },
    criticality: {
      score: missionSat.criticality?.score ?? 50,
      tier: tierFormatted,
      factors: [
        { name: 'Disaster monitoring support', value: 95, description: 'Emergency response verification' },
        { name: 'Unique capability', value: 90, description: 'National sensor monopoly' },
        { name: 'Service dependency', value: 88, description: 'Downstream institutional reliance' },
        { name: 'Availability of alternatives', value: 20, inverted: true, description: 'Few domestic substitutes' },
      ],
    },
    supportedServices: mappedServices,
    dataSource: missionSat.dataSource || 'real',
  };
}

/**
 * Builds a complete SatelliteMissionProfile from Mission API responses
 */
export function adaptToMissionProfile(
  cap: CapabilitiesResponseDto,
  crit: CriticalityResponseDto,
  alts: AlternativesResponseDto
): SatelliteMissionProfile {
  const normId = normalizeNoradId(cap.noradId);

  const sensors = [
    {
      sensor_name: cap.name + ' Primary Sensor',
      sensor_type: (cap.capabilities?.sensorFamily || 'OPTICAL_PAN_MS') as any,
      spatial_resolution_m: cap.capabilities?.spatialResolutionMeters ?? 0.25,
      swath_width_km: 17,
      spectral_bands: ['PAN', 'Blue', 'Green', 'Red', 'NIR'],
      revisit_time_days: cap.capabilities?.revisitDays ?? 4.5,
      primary_application: cap.capabilities?.sensorType || 'Earth Observation',
    },
  ];

  // Map factor breakdown
  const factors = crit.factors || [];
  const factorMap: Record<string, number> = {};
  factors.forEach((f) => {
    factorMap[f.id] = f.value;
  });

  const criticality: CriticalityAssessment = {
    score: crit.score,
    tier: (crit.tier as any) || 'TIER_1_CRITICAL',
    rationale: crit.formula || `Score calculated under ${crit.methodology}`,
    breakdown: {
      life_safety_support: factorMap.disasterMonitoringSupport ?? 94,
      disaster_management: factorMap.disasterMonitoringSupport ?? 94,
      national_infrastructure: factorMap.nationalInfrastructureDefence ?? 95,
      commercial_scientific: factorMap.commercialScientificValue ?? 92,
    },
    scoring_factors: factors.map((f) => `${f.name}: ${f.value}/100 (wt: ${f.weight})`),
  };

  const earthImpact: EarthServiceImpact = {
    norad_id: normId,
    satellite_name: cap.name,
    disrupted_sectors: (cap.supportedServices || []).map((s) => s.sector),
    immediate_consequences: (cap.supportedServices || []).map((s) => s.impactSummary),
    regional_exposure: cap.capabilities?.coverageRegions || ['India', 'South Asia'],
    lead_time_to_impact_hours: 12,
    service_degradation_severity: crit.score >= 85 ? 'SEVERE' : crit.score >= 70 ? 'HIGH' : 'MODERATE',
  };

  const continuityAlternatives: AlternativeSatellite[] = (alts.alternatives || []).map((cand) => {
    return {
      norad_id: normalizeNoradId(cand.noradId),
      name: cand.name,
      operator: formatOperator(cand.operator),
      orbit_regime: cand.category || 'LEO',
      sensor_type: cand.comparison?.[0]?.alternativeValue || 'Alternative Sensor',
      sensor_parity: cand.capabilityMatch >= 80 ? 'FULL' : cand.capabilityMatch >= 50 ? 'PARTIAL' : 'MINIMAL',
      revisit_time_hours: 48,
      coverage_overlap_pct: cand.capabilityMatch,
      redundancy_gaps: (cand.comparison || []).map((comp) => ({
        parameter: comp.label,
        target_value: comp.targetValue,
        alternative_value: comp.alternativeValue,
        impact_assessment: comp.limitationNote || `${comp.label} status: ${comp.comparisonStatus}`,
      })),
      viability_verdict:
        cand.limitations?.[0] || `Candidate provides ${cand.capabilityMatch}% functional overlap.`,
    };
  });

  return {
    norad_id: normId,
    name: cap.name,
    operator: formatOperator(cap.operator),
    country: cap.country,
    launch_year: cap.launchYear,
    mission_category: (cap.category?.toUpperCase() || 'EARTH_OBSERVATION') as any,
    primary_mission_purpose: cap.missionSummary,
    verified_operational_status: (cap.status?.toUpperCase() || 'OPERATIONAL') as any,
    sensors,
    criticality,
    earth_impact: earthImpact,
    continuity_alternatives: continuityAlternatives,
    dataSource: cap.dataSource || 'real',
  };
}

/**
 * Adapts BriefingResponseDto into OperatorAIBriefing
 */
export function adaptToAIBriefing(dto: BriefingResponseDto): OperatorAIBriefing {
  return {
    conjunction_id: dto.conjunctionId || 'CONJ-UNKNOWN',
    executive_summary: dto.summary || dto.headline || 'Operator briefing generated.',
    physical_encounter_analysis: dto.physicalSeparationContext || 'Physical encounter geometry under review.',
    mission_vulnerability_analysis: dto.missionImportanceContext || 'Mission vulnerability analyzed.',
    service_continuity_plan: dto.serviceImpactAndContinuity || 'Continuity plan established.',
    actionable_recommendations: dto.recommendedActions || [
      'Verify preliminary screening with validated CDM from operational authority.',
      'Review updated TLEs prior to close approach.',
    ],
    scientific_disclaimer: dto.scientificNotice || 'Preliminary screening, not a validated conjunction assessment.',
    generated_at: dto.generatedAt || new Date().toISOString(),
    dataSource: dto.dataSource || 'real',
    generatedBy: dto.generatedBy,
  };
}
