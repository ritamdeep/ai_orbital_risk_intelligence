import { 
  SatelliteMissionProfile, 
  CriticalityAssessment, 
  EarthServiceImpact, 
  AlternativeSatellite, 
  OperatorAIBriefing 
} from '../types/intelligence';
import { missionApi } from '../api/missionApi';
import { adaptToMissionProfile, adaptToAIBriefing, normalizeNoradId } from '../api/adapters';
import { MOCK_MISSION_PROFILES } from './mock/mockSatellites';
import { MOCK_AI_BRIEFINGS } from './mock/mockConjunctions';
import { FORCE_MOCK_MODE } from '../api/client';

export const intelligenceService = {
  /**
   * Fetch mission profile and payload instrumentation for a satellite
   */
  async getMissionProfile(noradId: number): Promise<SatelliteMissionProfile | null> {
    const normId = normalizeNoradId(noradId);
    if (FORCE_MOCK_MODE) {
      return MOCK_MISSION_PROFILES[normId] || MOCK_MISSION_PROFILES[44431] || null;
    }
    try {
      const [cap, crit, alts] = await Promise.all([
        missionApi.getCapabilities(normId),
        missionApi.getCriticality(normId),
        missionApi.getAlternatives(normId, 5),
      ]);
      return adaptToMissionProfile(cap, crit, alts);
    } catch {
      return MOCK_MISSION_PROFILES[normId] || MOCK_MISSION_PROFILES[44431] || null;
    }
  },

  /**
   * Fetch explainable criticality assessment
   */
  async getCriticalityScore(noradId: number): Promise<CriticalityAssessment | null> {
    const profile = await this.getMissionProfile(noradId);
    return profile ? profile.criticality : null;
  },

  /**
   * Fetch downstream Earth service impact analysis
   */
  async getEarthImpact(noradId: number): Promise<EarthServiceImpact | null> {
    const profile = await this.getMissionProfile(noradId);
    return profile ? profile.earth_impact : null;
  },

  /**
   * Fetch candidate alternative satellites with redundancy gaps
   */
  async getContinuityAlternatives(noradId: number): Promise<AlternativeSatellite[]> {
    const profile = await this.getMissionProfile(noradId);
    return profile ? profile.continuity_alternatives : [];
  },

  /**
   * Fetch or trigger AI-generated decision-support briefing for a conjunction event
   */
  async getAIOperatorBriefing(conjunctionId: string, noradId = 44431): Promise<OperatorAIBriefing | null> {
    const normId = normalizeNoradId(noradId);
    if (FORCE_MOCK_MODE) {
      return MOCK_AI_BRIEFINGS[conjunctionId] || MOCK_AI_BRIEFINGS['CONJ-2026-0042'] || null;
    }
    try {
      const dto = await missionApi.getBriefing(normId, { conjunctionId });
      return adaptToAIBriefing(dto);
    } catch {
      return MOCK_AI_BRIEFINGS[conjunctionId] || MOCK_AI_BRIEFINGS['CONJ-2026-0042'] || null;
    }
  }
};
