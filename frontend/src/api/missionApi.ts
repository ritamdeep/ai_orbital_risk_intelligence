/**
 * ASTRAVIGIL Mission Intelligence API Client
 * Microservice on Port 8001
 */

import { apiFetch, MISSION_API_BASE, FetchOptions } from './client';

export interface MissionHealthResponse {
  status: string;
  service: string;
  port: number;
  satellitesLoaded: number;
  methodology: string;
  llmConfigured: boolean;
  dataSource: 'real' | 'mock';
}

export interface SupportedEarthServiceDto {
  serviceId: string;
  name: string;
  sector: string;
  impactSummary: string;
  dataSource: 'real' | 'mock';
  sourceNote?: string;
}

export interface SatelliteCapabilitiesDto {
  sensorType: string;
  sensorFamily: string;
  allWeatherCapable: boolean;
  spatialResolution: string;
  spatialResolutionMeters?: number | null;
  revisitTime: string;
  revisitDays?: number | null;
  coverage: string;
  coverageRegions: string[];
  dataAccess: string;
  dataAccessTier: string;
}

export interface CriticalitySummaryDto {
  score: number;
  tier: 'TIER_1_CRITICAL' | 'TIER_2_HIGH' | 'TIER_3_MODERATE' | 'TIER_4_LOW' | string;
  tierLabel: string;
  methodology: string;
}

export interface MissionSatelliteSummaryDto {
  noradId: number;
  verifiedNoradId?: number | null;
  cosparId: string;
  name: string;
  operator: string;
  country: string;
  category: string;
  orbitRegime: string;
  orbitSubtype: string;
  status: string;
  launchYear: number;
  missionSummary: string;
  capabilities: SatelliteCapabilitiesDto;
  supportedServices: SupportedEarthServiceDto[];
  criticality: CriticalitySummaryDto;
  dataSource: 'real' | 'mock';
  sources: string[];
}

export interface SatelliteListResponseDto {
  satellites: MissionSatelliteSummaryDto[];
  total: number;
  methodology: string;
  disclaimer?: string;
}

export interface CapabilitiesResponseDto {
  noradId: number;
  verifiedNoradId?: number | null;
  name: string;
  operator: string;
  country: string;
  category: string;
  orbitRegime: string;
  orbitSubtype: string;
  status: string;
  launchYear: number;
  missionSummary: string;
  capabilities: SatelliteCapabilitiesDto;
  supportedServices: SupportedEarthServiceDto[];
  dataSource: 'real' | 'mock';
  fieldProvenance?: Record<string, { dataSource: 'real' | 'mock'; sourceNote: string }>;
  sources: string[];
}

export interface CriticalityFactorBreakdownDto {
  id: string;
  name: string;
  value: number;
  effectiveValue: number;
  weight: number;
  weightedContribution: number;
  inverted: boolean;
  direction: 'higher_is_more_critical' | 'lower_is_more_critical';
  description: string;
  dataSource: 'real' | 'mock';
  sourceNote: string;
}

export interface CriticalityResponseDto {
  noradId: number;
  verifiedNoradId?: number | null;
  name: string;
  operator: string;
  category: string;
  score: number;
  tier: 'TIER_1_CRITICAL' | 'TIER_2_HIGH' | 'TIER_3_MODERATE' | 'TIER_4_LOW' | string;
  tierLabel: string;
  methodology: string;
  formula: string;
  tierThresholds: Record<string, string>;
  factors: CriticalityFactorBreakdownDto[];
  supportedServices: SupportedEarthServiceDto[];
  independenceNotice: string;
  dataSource: 'real' | 'mock';
}

export interface FieldComparisonItemDto {
  field: 'sensorType' | 'spatialResolution' | 'revisitTime' | 'coverage' | 'dataAccess';
  label: string;
  targetValue: string;
  alternativeValue: string;
  matchPoints: number;
  maxPoints: number;
  comparisonStatus: 'MATCH' | 'PARTIAL' | 'GAP';
  limitationNote?: string | null;
}

export interface AlternativeCandidateDto {
  noradId: number;
  verifiedNoradId?: number | null;
  name: string;
  operator: string;
  country: string;
  category: string;
  status: string;
  capabilityMatch: number;
  comparison: FieldComparisonItemDto[];
  limitations: string[];
  dataSource: 'real' | 'mock';
  sources: string[];
}

export interface AlternativesResponseDto {
  noradId: number;
  verifiedNoradId?: number | null;
  name: string;
  category: string;
  matchingMethodology: string;
  alternatives: AlternativeCandidateDto[];
  redundancyGaps: string[];
  caveat: string;
  dataSource: 'real' | 'mock';
}

export interface BriefingRequestPayload {
  conjunctionId?: string;
  secondaryNoradId?: number;
  secondaryName?: string;
  secondaryObjectType?: 'DEBRIS' | 'PAYLOAD' | 'ROCKET_BODY' | 'UNKNOWN';
  missDistanceKm?: number;
  relativeVelocityKms?: number;
  tcaUtc?: string;
  screeningTier?: string;
  orbitalDataSource?: 'real' | 'cached_real' | 'simulated' | 'mock';
  activeHazardContext?: string;
}

export interface BriefingResponseDto {
  noradId: number;
  verifiedNoradId?: number | null;
  satelliteName: string;
  conjunctionId?: string | null;
  generatedBy: 'llm' | 'rule_based';
  fallbackReason?: string | null;
  model?: string | null;
  headline: string;
  summary: string;
  physicalSeparationContext: string;
  missionImportanceContext: string;
  serviceImpactAndContinuity: string;
  recommendedActions: string[];
  criticalityScore: number;
  criticalityTier: string;
  scientificNotice: string;
  generatedAt: string;
  dataSource: 'real' | 'mock';
}

export const missionApi = {
  async getHealth(options?: FetchOptions): Promise<MissionHealthResponse> {
    return apiFetch<MissionHealthResponse>(`${MISSION_API_BASE}/health`, options);
  },

  async getSatellites(
    filters: { category?: string; operator?: string; status?: string; search?: string } = {},
    options?: FetchOptions
  ): Promise<SatelliteListResponseDto> {
    const search = new URLSearchParams();
    if (filters.category) search.set('category', filters.category);
    if (filters.operator) search.set('operator', filters.operator);
    if (filters.status) search.set('status', filters.status);
    if (filters.search) search.set('search', filters.search);
    const qs = search.toString();
    const url = `${MISSION_API_BASE}/api/mission/satellites${qs ? `?${qs}` : ''}`;
    return apiFetch<SatelliteListResponseDto>(url, options);
  },

  async getCapabilities(noradId: number, options?: FetchOptions): Promise<CapabilitiesResponseDto> {
    return apiFetch<CapabilitiesResponseDto>(
      `${MISSION_API_BASE}/api/mission/satellites/${noradId}/capabilities`,
      options
    );
  },

  async getCriticality(noradId: number, options?: FetchOptions): Promise<CriticalityResponseDto> {
    return apiFetch<CriticalityResponseDto>(
      `${MISSION_API_BASE}/api/mission/satellites/${noradId}/criticality`,
      options
    );
  },

  async getAlternatives(
    noradId: number,
    maxResults: number = 5,
    options?: FetchOptions
  ): Promise<AlternativesResponseDto> {
    return apiFetch<AlternativesResponseDto>(
      `${MISSION_API_BASE}/api/mission/satellites/${noradId}/alternatives?maxResults=${maxResults}`,
      options
    );
  },

  async getBriefing(
    noradId: number,
    payload: BriefingRequestPayload = {},
    options?: FetchOptions
  ): Promise<BriefingResponseDto> {
    // 20 second timeout for briefing (LLM or rule-based synthesis)
    return apiFetch<BriefingResponseDto>(
      `${MISSION_API_BASE}/api/mission/satellites/${noradId}/briefing`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        timeoutMs: options?.timeoutMs ?? 20000,
        ...options,
      }
    );
  },
};
