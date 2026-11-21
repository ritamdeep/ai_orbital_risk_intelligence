export type SatelliteCategory =
  | 'All'
  | 'Earth Observation'
  | 'Communication'
  | 'Navigation'
  | 'Weather'
  | 'Disaster Monitoring'
  | 'Scientific / Student';

export interface SatelliteCapabilities {
  sensorType: string;
  spatialResolution: string;
  revisitTime: string;
  coverage: string;
  dataAccess: string;
}

export interface CriticalityFactor {
  name: string;
  value: number; // 0 - 100
  description: string;
  inverted?: boolean; // When true, lower value indicates higher criticality
}

export interface CriticalityScoreData {
  score: number;
  tier: string;
  factors: CriticalityFactor[];
}

export interface SupportedEarthService {
  name: string;
  icon: 'flood' | 'cyclone' | 'urban' | 'defense' | 'ocean' | 'agriculture' | 'weather' | 'search';
}

export interface SatelliteCatalogueItem {
  id: string;
  name: string;
  noradId: number;
  category: 'Earth Observation' | 'Communication' | 'Navigation' | 'Weather' | 'Disaster Monitoring' | 'Scientific / Student';
  categoryChipLabel: string;
  orbit: string; // e.g. "SSO", "LEO", "GEO"
  orbitSubtype: string; // e.g. "LEO / Sun-synchronous", "GEO / Geostationary"
  altitudeKm: number;
  periodMin: number;
  inclinationDeg: number;
  operator: string;
  status: 'Operational' | 'Degraded' | 'Standby' | 'Decommissioned';
  capabilities: SatelliteCapabilities;
  criticality: CriticalityScoreData;
  supportedServices: SupportedEarthService[];
  dataSource: 'mock' | 'real';
}
