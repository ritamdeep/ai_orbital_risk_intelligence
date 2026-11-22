/**
 * ASTRAVIGIL Orbital Risk Engine API Client
 * Microservice on Port 8000
 */

import { apiFetch, ORBITAL_API_BASE, FetchOptions } from './client';

export interface OrbitalHealthResponse {
  status: string;
  service: string;
  version: string;
  timestampUtc: string;
  tleSource: 'celestrak' | 'mock';
  objectsCount: number;
}

export interface OrbitalPositionDto {
  timestampUtc: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  eciX: number;
  eciY: number;
  eciZ: number;
  speedKmS: number;
}

export interface SatelliteSummaryDto {
  noradId: number;
  name: string;
  intlDesignator?: string | null;
  type: 'payload' | 'debris' | 'rocket_body' | 'unknown' | string;
  countryCode?: string | null;
  orbitRegime?: string | null;
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  periodMin: number;
  tleEpochUtc: string;
  position: OrbitalPositionDto;
  isActive: boolean;
  dataSource: 'real' | 'mock';
}

export interface ConjunctionEventDto {
  eventId: string;
  primaryObject: SatelliteSummaryDto;
  secondaryObject: SatelliteSummaryDto;
  tcaUtc: string;
  missDistanceKm: number;
  relativeVelocityKmS: number;
  altitudeAtTcaKm: number;
  tleEpochUtc: string;
  tleUncertaintyKm: number;
  screeningNote: string;
  dataSource: 'real' | 'mock';
  isPreliminaryScreening: boolean;
  investigationStatus: 'UNREVIEWED' | 'UNDER_EVALUATION' | 'MONITORING' | 'DISMISSED' | string;
}

/**
 * Resolves CARTOSAT-3 contract alias:
 * In Orbital Risk engine, Cartosat-3 is cataloged under verified NORAD ID 44804.
 */
function resolveOrbitalNoradId(id: number): number {
  if (id === 44431) return 44804;
  return id;
}

export const orbitalApi = {
  async getHealth(options?: FetchOptions): Promise<OrbitalHealthResponse> {
    return apiFetch<OrbitalHealthResponse>(`${ORBITAL_API_BASE}/health`, options);
  },

  async getSatellites(
    type?: 'payload' | 'debris' | 'rocket_body',
    options?: FetchOptions
  ): Promise<SatelliteSummaryDto[]> {
    const url = type
      ? `${ORBITAL_API_BASE}/api/orbital/satellites?type=${encodeURIComponent(type)}`
      : `${ORBITAL_API_BASE}/api/orbital/satellites`;
    return apiFetch<SatelliteSummaryDto[]>(url, options);
  },

  async getSatellite(noradId: number, options?: FetchOptions): Promise<SatelliteSummaryDto> {
    const queryId = resolveOrbitalNoradId(noradId);
    return apiFetch<SatelliteSummaryDto>(`${ORBITAL_API_BASE}/api/orbital/satellites/${queryId}`, options);
  },

  async getConjunctions(
    params: { windowHours?: number; maxSeparationKm?: number } = {},
    options?: FetchOptions
  ): Promise<ConjunctionEventDto[]> {
    const search = new URLSearchParams();
    if (params.windowHours !== undefined) {
      search.set('windowHours', params.windowHours.toString());
    }
    if (params.maxSeparationKm !== undefined) {
      search.set('maxSeparationKm', params.maxSeparationKm.toString());
    }
    const qs = search.toString();
    const url = `${ORBITAL_API_BASE}/api/orbital/conjunctions${qs ? `?${qs}` : ''}`;
    return apiFetch<ConjunctionEventDto[]>(url, options);
  },

  async getConjunction(eventId: string, options?: FetchOptions): Promise<ConjunctionEventDto> {
    return apiFetch<ConjunctionEventDto>(
      `${ORBITAL_API_BASE}/api/orbital/conjunctions/${encodeURIComponent(eventId)}`,
      options
    );
  },
};
