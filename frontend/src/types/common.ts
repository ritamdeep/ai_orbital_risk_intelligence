export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'CAUTION' | 'INFO';

export type InvestigationStatus = 'UNREVIEWED' | 'UNDER_EVALUATION' | 'MONITORING' | 'DISMISSED';

export type ObjectType = 'PAYLOAD' | 'DEBRIS' | 'ROCKET_BODY' | 'UNKNOWN';

export type OrbitRegime = 'LEO' | 'MEO' | 'GEO' | 'SSO' | 'HEO';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GeodeticCoordinate {
  latitude: number;
  longitude: number;
  altitude_km: number;
}

export interface DataSourceMetadata {
  source_name: string;
  epoch_time: string;
  is_mock: boolean;
  scientific_note?: string;
}
