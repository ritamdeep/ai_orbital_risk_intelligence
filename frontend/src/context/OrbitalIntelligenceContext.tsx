/**
 * ASTRAVIGIL Orbital Intelligence Context & Provider
 *
 * Single source of truth across all 5 dashboard views:
 * - Overview
 * - Satellite Intelligence
 * - Risk Analysis
 * - Mission Impact
 * - Alerts Centre
 *
 * Enforces:
 * - Live microservices connection with automatic fallback to mock data on error/timeout
 * - True telemetry chip state: 'Live' | 'Partial' | 'Mock'
 * - Consistent cross-tab values (same satellite always has identical score, tier, and miss distance)
 * - 60s periodic refetch of conjunctions when document is visible
 * - Local persistence of alert investigation statuses keyed by eventId
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { orbitalApi, SatelliteSummaryDto, ConjunctionEventDto } from '../api/orbitalApi';
import { missionApi, MissionSatelliteSummaryDto } from '../api/missionApi';
import {
  adaptOrbitalToSpaceObject,
  adaptConjunctionEvent,
  adaptToCatalogueItem,
  adaptToMissionProfile,
  adaptToAIBriefing,
  normalizeNoradId,
  isSameSatellite,
} from '../api/adapters';
import { SpaceObjectSummary, ConjunctionEvent } from '../types/orbital';
import { SatelliteCatalogueItem } from '../types/satelliteIntelligence';
import { SatelliteMissionProfile, OperatorAIBriefing } from '../types/intelligence';
import { InvestigationStatus } from '../types/common';
import { FORCE_MOCK_MODE } from '../api/client';

// Mock fixtures for fallback
import { MOCK_SPACE_OBJECTS, MOCK_MISSION_PROFILES } from '../services/mock/mockSatellites';
import { MOCK_SATELLITE_CATALOGUE } from '../services/mock/mockSatelliteIntelligence';
import { MOCK_CONJUNCTIONS, MOCK_AI_BRIEFINGS } from '../services/mock/mockConjunctions';

export type SystemDataFidelity = 'Live' | 'Partial' | 'Mock';

interface OrbitalIntelligenceContextType {
  // Primary datasets
  satellites: SatelliteCatalogueItem[];
  objects: SpaceObjectSummary[];
  conjunctions: ConjunctionEvent[];

  // Selected state
  selectedNoradId: number;
  selectedSatellite: SatelliteCatalogueItem | null;
  selectedObject: SpaceObjectSummary | null;
  selectedConjunction: ConjunctionEvent | null;

  // Detailed profiles & briefings
  selectedMissionProfile: SatelliteMissionProfile | null;
  aiBriefing: OperatorAIBriefing | null;

  // System status & provenance
  loading: boolean;
  conjunctionsLoading: boolean;
  briefingLoading: boolean;
  error: string | null;
  orbitalSource: 'real' | 'mock';
  missionSource: 'real' | 'mock';
  overallFidelity: SystemDataFidelity;

  // Actions
  selectSatellite: (noradId: number) => void;
  selectConjunction: (conj: ConjunctionEvent | string) => void;
  updateInvestigationStatus: (eventId: string, status: InvestigationStatus) => Promise<void>;
  fetchMissionProfileForSatellite: (noradId: number) => Promise<SatelliteMissionProfile | null>;
  fetchBriefingForConjunction: (conj: ConjunctionEvent) => Promise<OperatorAIBriefing | null>;
  refetchAll: () => Promise<void>;
  refetchConjunctionsOnly: () => Promise<void>;
}

const OrbitalIntelligenceContext = createContext<OrbitalIntelligenceContextType | null>(null);

const STORAGE_KEY_PREFIX = 'astravigil_status_';

function getStoredStatus(eventId: string): InvestigationStatus | null {
  try {
    const val = localStorage.getItem(`${STORAGE_KEY_PREFIX}${eventId}`);
    if (val && ['UNREVIEWED', 'UNDER_EVALUATION', 'MONITORING', 'DISMISSED'].includes(val)) {
      return val as InvestigationStatus;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveStoredStatus(eventId: string, status: InvestigationStatus): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${eventId}`, status);
  } catch {
    // Ignore storage errors
  }
}

export const OrbitalIntelligenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [satellites, setSatellites] = useState<SatelliteCatalogueItem[]>([]);
  const [objects, setObjects] = useState<SpaceObjectSummary[]>([]);
  const [conjunctions, setConjunctions] = useState<ConjunctionEvent[]>([]);

  const [selectedNoradId, setSelectedNoradId] = useState<number>(44431); // Default CARTOSAT-3
  const [selectedConjunction, setSelectedConjunction] = useState<ConjunctionEvent | null>(null);
  const [selectedMissionProfile, setSelectedMissionProfile] = useState<SatelliteMissionProfile | null>(null);
  const [aiBriefing, setAiBriefing] = useState<OperatorAIBriefing | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [conjunctionsLoading, setConjunctionsLoading] = useState<boolean>(false);
  const [briefingLoading, setBriefingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [orbitalSource, setOrbitalSource] = useState<'real' | 'mock'>('mock');
  const [missionSource, setMissionSource] = useState<'real' | 'mock'>('mock');

  // Cache for loaded mission profiles: noradId -> profile
  const profileCache = useRef<Record<number, SatelliteMissionProfile>>({});

  // 1. Fetch Orbital Satellites
  const fetchOrbitalObjects = async (): Promise<{ objs: SpaceObjectSummary[]; source: 'real' | 'mock' }> => {
    if (FORCE_MOCK_MODE) {
      return { objs: MOCK_SPACE_OBJECTS, source: 'mock' };
    }
    try {
      const liveDtos = await orbitalApi.getSatellites();
      if (Array.isArray(liveDtos) && liveDtos.length > 0) {
        const adapted = liveDtos.map(adaptOrbitalToSpaceObject);
        return { objs: adapted, source: 'real' };
      }
      throw new Error('Empty satellite list from orbital API');
    } catch (err) {
      console.warn('[ASTRAVIGIL] Orbital API unavailable, falling back to mock space objects:', err);
      return { objs: MOCK_SPACE_OBJECTS, source: 'mock' };
    }
  };

  // 2. Fetch Mission Satellites Catalogue
  const fetchMissionSatellites = async (
    orbitalObjs: SpaceObjectSummary[]
  ): Promise<{ catalogue: SatelliteCatalogueItem[]; source: 'real' | 'mock' }> => {
    if (FORCE_MOCK_MODE) {
      return { catalogue: MOCK_SATELLITE_CATALOGUE, source: 'mock' };
    }
    try {
      const response = await missionApi.getSatellites();
      if (response && Array.isArray(response.satellites) && response.satellites.length > 0) {
        const joined = response.satellites.map((mSat) => {
          const matchedOrbital = orbitalObjs.find((o) => isSameSatellite(o.norad_id, mSat.noradId));
          return adaptToCatalogueItem(mSat, matchedOrbital);
        });
        return { catalogue: joined, source: 'real' };
      }
      throw new Error('Empty mission satellite list from mission API');
    } catch (err) {
      console.warn('[ASTRAVIGIL] Mission API unavailable, falling back to mock catalogue:', err);
      return { catalogue: MOCK_SATELLITE_CATALOGUE, source: 'mock' };
    }
  };

  // 3. Fetch Conjunction Screenings
  const fetchConjunctionEvents = async (): Promise<{ events: ConjunctionEvent[]; source: 'real' | 'mock' }> => {
    if (FORCE_MOCK_MODE) {
      const mergedMock = MOCK_CONJUNCTIONS.map((c) => {
        const stored = getStoredStatus(c.conjunction_id);
        return stored ? { ...c, investigation_status: stored } : c;
      });
      return { events: mergedMock, source: 'mock' };
    }
    try {
      // Query wide window to ensure active encounters are surfaced
      const liveConjDtos = await orbitalApi.getConjunctions({ windowHours: 168, maxSeparationKm: 200 });
      if (Array.isArray(liveConjDtos) && liveConjDtos.length > 0) {
        const adapted = liveConjDtos.map(adaptConjunctionEvent).map((c) => {
          const stored = getStoredStatus(c.conjunction_id);
          return stored ? { ...c, investigation_status: stored } : c;
        });
        return { events: adapted, source: 'real' };
      }
      throw new Error('Empty conjunctions from orbital API');
    } catch (err) {
      console.warn('[ASTRAVIGIL] Orbital conjunction screening unavailable, falling back to mock events:', err);
      const mergedMock = MOCK_CONJUNCTIONS.map((c) => {
        const stored = getStoredStatus(c.conjunction_id);
        return stored ? { ...c, investigation_status: stored } : c;
      });
      return { events: mergedMock, source: 'mock' };
    }
  };

  // 4. Fetch Mission Profile for a Specific Satellite
  const fetchMissionProfileForSatellite = useCallback(
    async (noradId: number): Promise<SatelliteMissionProfile | null> => {
      const normId = normalizeNoradId(noradId);
      if (profileCache.current[normId]) {
        return profileCache.current[normId];
      }

      if (FORCE_MOCK_MODE) {
        const mockProfile = MOCK_MISSION_PROFILES[normId] || MOCK_MISSION_PROFILES[44431] || null;
        if (mockProfile) profileCache.current[normId] = mockProfile;
        return mockProfile;
      }

      try {
        const [cap, crit, alts] = await Promise.all([
          missionApi.getCapabilities(normId),
          missionApi.getCriticality(normId),
          missionApi.getAlternatives(normId, 5),
        ]);
        const profile = adaptToMissionProfile(cap, crit, alts);
        profileCache.current[normId] = profile;
        return profile;
      } catch (err) {
        console.warn(`[ASTRAVIGIL] Failed to fetch live mission profile for NORAD ${normId}, falling back to mock:`, err);
        const mockProfile = MOCK_MISSION_PROFILES[normId] || MOCK_MISSION_PROFILES[44431] || null;
        if (mockProfile) profileCache.current[normId] = mockProfile;
        return mockProfile;
      }
    },
    []
  );

  // 5. Fetch Operator AI Briefing for a Conjunction
  const fetchBriefingForConjunction = useCallback(
    async (conj: ConjunctionEvent): Promise<OperatorAIBriefing | null> => {
      setBriefingLoading(true);
      const primaryNormId = normalizeNoradId(conj.primary_object.norad_id);

      if (FORCE_MOCK_MODE) {
        const mockBriefing = MOCK_AI_BRIEFINGS[conj.conjunction_id] || MOCK_AI_BRIEFINGS['CONJ-2026-0042'] || null;
        setAiBriefing(mockBriefing);
        setBriefingLoading(false);
        return mockBriefing;
      }

      try {
        const briefingDto = await missionApi.getBriefing(primaryNormId, {
          conjunctionId: conj.conjunction_id,
          secondaryNoradId: conj.secondary_object.norad_id,
          secondaryName: conj.secondary_object.name,
          secondaryObjectType: conj.secondary_object.object_type as any,
          missDistanceKm: conj.miss_distance_km,
          relativeVelocityKms: conj.relative_velocity_km_s,
          tcaUtc: conj.tca,
        });
        const adapted = adaptToAIBriefing(briefingDto);
        setAiBriefing(adapted);
        setBriefingLoading(false);
        return adapted;
      } catch (err) {
        console.warn(`[ASTRAVIGIL] Live AI Briefing failed or timed out, falling back to mock briefing:`, err);
        const mockBriefing = MOCK_AI_BRIEFINGS[conj.conjunction_id] || MOCK_AI_BRIEFINGS['CONJ-2026-0042'] || null;
        setAiBriefing(mockBriefing);
        setBriefingLoading(false);
        return mockBriefing;
      }
    },
    []
  );

  // Initial Full Load
  const refetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orbRes, conjRes] = await Promise.all([fetchOrbitalObjects(), fetchConjunctionEvents()]);

      setObjects(orbRes.objs);
      setOrbitalSource(orbRes.source);

      setConjunctions(conjRes.events);

      const missRes = await fetchMissionSatellites(orbRes.objs);
      setSatellites(missRes.catalogue);
      setMissionSource(missRes.source);

      // Select initial conjunction if available
      const initConj = conjRes.events[0] || null;
      setSelectedConjunction(initConj);

      // Select default satellite (CARTOSAT-3 or first available)
      const targetId = 44431;
      setSelectedNoradId(targetId);

      // Fetch mission profile and briefing for defaults
      const profile = await fetchMissionProfileForSatellite(targetId);
      setSelectedMissionProfile(profile);

      if (initConj) {
        await fetchBriefingForConjunction(initConj);
      }
    } catch (err: any) {
      console.error('[ASTRAVIGIL] Fatal error during data initialization:', err);
      setError(err?.message || 'Failed to initialize space intelligence feeds.');
    } finally {
      setLoading(false);
    }
  }, [fetchMissionProfileForSatellite, fetchBriefingForConjunction]);

  // Periodic Refetch for Conjunctions (every 60s while tab is visible)
  const refetchConjunctionsOnly = useCallback(async () => {
    if (document.hidden) return;
    setConjunctionsLoading(true);
    try {
      const res = await fetchConjunctionEvents();
      setConjunctions(res.events);
      setOrbitalSource(res.source);
    } catch (err) {
      console.warn('[ASTRAVIGIL] Background conjunctions refresh failed:', err);
    } finally {
      setConjunctionsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  // Set up 60s conjunction refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      refetchConjunctionsOnly();
    }, 60000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetchConjunctionsOnly();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetchConjunctionsOnly]);

  // Selection handlers
  const selectSatellite = useCallback(
    async (noradId: number) => {
      const normId = normalizeNoradId(noradId);
      setSelectedNoradId(normId);

      // Also load mission profile
      const prof = await fetchMissionProfileForSatellite(normId);
      setSelectedMissionProfile(prof);

      // If there's an active conjunction associated with this satellite, select it
      const related = conjunctions.find((c) => isSameSatellite(c.primary_object.norad_id, normId));
      if (related) {
        setSelectedConjunction(related);
        await fetchBriefingForConjunction(related);
      }
    },
    [conjunctions, fetchMissionProfileForSatellite, fetchBriefingForConjunction]
  );

  const selectConjunction = useCallback(
    async (conjOrId: ConjunctionEvent | string) => {
      let conj: ConjunctionEvent | undefined;
      if (typeof conjOrId === 'string') {
        conj = conjunctions.find((c) => c.conjunction_id === conjOrId || c.eventId === conjOrId);
      } else {
        conj = conjOrId;
      }
      if (!conj) return;

      setSelectedConjunction(conj);
      const normPrimaryId = normalizeNoradId(conj.primary_object.norad_id);
      setSelectedNoradId(normPrimaryId);

      // Fetch mission profile and briefing
      const prof = await fetchMissionProfileForSatellite(normPrimaryId);
      setSelectedMissionProfile(prof);
      await fetchBriefingForConjunction(conj);
    },
    [conjunctions, fetchMissionProfileForSatellite, fetchBriefingForConjunction]
  );

  // Status update persistence
  const updateInvestigationStatus = useCallback(async (eventId: string, status: InvestigationStatus) => {
    saveStoredStatus(eventId, status);
    setConjunctions((prev) =>
      prev.map((c) => (c.conjunction_id === eventId || c.eventId === eventId ? { ...c, investigation_status: status } : c))
    );
    setSelectedConjunction((prev) =>
      prev && (prev.conjunction_id === eventId || prev.eventId === eventId)
        ? { ...prev, investigation_status: status }
        : prev
    );
  }, []);

  // Compute overall system data fidelity for the top-bar chip
  let overallFidelity: SystemDataFidelity = 'Mock';
  if (FORCE_MOCK_MODE) {
    overallFidelity = 'Mock';
  } else if (orbitalSource === 'real' && missionSource === 'real') {
    overallFidelity = 'Live';
  } else if (orbitalSource === 'real' || missionSource === 'real') {
    overallFidelity = 'Partial';
  } else {
    overallFidelity = 'Mock';
  }

  // Selected object & satellite derived properties
  const selectedSatellite =
    satellites.find((s) => isSameSatellite(s.noradId, selectedNoradId)) || satellites[0] || null;

  const selectedObject =
    objects.find((o) => isSameSatellite(o.norad_id, selectedNoradId)) || objects[0] || null;

  const contextValue: OrbitalIntelligenceContextType = {
    satellites,
    objects,
    conjunctions,
    selectedNoradId,
    selectedSatellite,
    selectedObject,
    selectedConjunction,
    selectedMissionProfile,
    aiBriefing,
    loading,
    conjunctionsLoading,
    briefingLoading,
    error,
    orbitalSource,
    missionSource,
    overallFidelity,
    selectSatellite,
    selectConjunction,
    updateInvestigationStatus,
    fetchMissionProfileForSatellite,
    fetchBriefingForConjunction,
    refetchAll,
    refetchConjunctionsOnly,
  };

  return (
    <OrbitalIntelligenceContext.Provider value={contextValue}>{children}</OrbitalIntelligenceContext.Provider>
  );
};

export function useOrbitalIntelligence(): OrbitalIntelligenceContextType {
  const context = useContext(OrbitalIntelligenceContext);
  if (!context) {
    throw new Error('useOrbitalIntelligence must be used within an OrbitalIntelligenceProvider');
  }
  return context;
}
