import { 
  SatelliteMissionProfile, 
  CriticalityAssessment, 
  EarthServiceImpact, 
  AlternativeSatellite, 
  OperatorAIBriefing 
} from '../types/intelligence';
import { fetchFromApi, USE_MOCK_DATA } from './apiClient';
import { MOCK_MISSION_PROFILES } from './mock/mockSatellites';
import { MOCK_AI_BRIEFINGS } from './mock/mockConjunctions';

export const intelligenceService = {
  /**
   * Fetch mission profile and payload instrumentation for a satellite
   */
  async getMissionProfile(noradId: number): Promise<SatelliteMissionProfile | null> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 100));
      return MOCK_MISSION_PROFILES[noradId] || null;
    }
    return fetchFromApi<SatelliteMissionProfile>(`/intelligence/mission/${noradId}`);
  },

  /**
   * Fetch explainable criticality assessment
   */
  async getCriticalityScore(noradId: number): Promise<CriticalityAssessment | null> {
    if (USE_MOCK_DATA) {
      const profile = MOCK_MISSION_PROFILES[noradId];
      return profile ? profile.criticality : null;
    }
    return fetchFromApi<CriticalityAssessment>(`/intelligence/criticality/${noradId}`);
  },

  /**
   * Fetch downstream Earth service impact analysis
   */
  async getEarthImpact(noradId: number): Promise<EarthServiceImpact | null> {
    if (USE_MOCK_DATA) {
      const profile = MOCK_MISSION_PROFILES[noradId];
      return profile ? profile.earth_impact : null;
    }
    return fetchFromApi<EarthServiceImpact>(`/intelligence/earth-impact/${noradId}`);
  },

  /**
   * Fetch candidate alternative satellites with redundancy gaps
   */
  async getContinuityAlternatives(noradId: number): Promise<AlternativeSatellite[]> {
    if (USE_MOCK_DATA) {
      const profile = MOCK_MISSION_PROFILES[noradId];
      return profile ? profile.continuity_alternatives : [];
    }
    return fetchFromApi<AlternativeSatellite[]>(`/intelligence/alternatives/${noradId}`);
  },

  /**
   * Fetch or trigger AI-generated decision-support briefing for a conjunction event
   */
  async getAIOperatorBriefing(conjunctionId: string): Promise<OperatorAIBriefing | null> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_AI_BRIEFINGS[conjunctionId] || null;
    }
    return fetchFromApi<OperatorAIBriefing>(`/intelligence/briefing/${conjunctionId}`, {
      method: 'POST',
      body: JSON.stringify({ conjunction_id: conjunctionId }),
    });
  }
};
