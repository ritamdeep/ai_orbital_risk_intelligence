import { ObjectType, OrbitRegime, GeodeticCoordinate, DataSourceMetadata } from './common';

export interface SpaceObjectSummary {
  norad_id: number;
  name: string;
  intl_designator: string;
  object_type: ObjectType;
  country_code: string;
  orbit_regime: OrbitRegime;
  perigee_km: number;
  apogee_km: number;
  inclination_deg: number;
  period_min: number;
  current_position: GeodeticCoordinate;
  tle_epoch: string;
  is_active: boolean;
  dataSource?: 'real' | 'mock';
}

export interface ConjunctionEvent {
  conjunction_id: string;
  eventId?: string; // Contract alias
  primary_object: {
    norad_id: number;
    name: string;
    object_type: ObjectType;
    orbit_regime: OrbitRegime;
    country_code: string;
  };
  secondary_object: {
    norad_id: number;
    name: string;
    object_type: ObjectType;
    orbit_regime: OrbitRegime;
    country_code: string;
    origin_debris_event?: string;
  };
  tca: string; // ISO-8601 UTC Time of Closest Approach
  tcaUtc?: string; // Contract alias
  miss_distance_km: number; // Minimum physical separation
  missDistanceKm?: number; // Contract alias
  relative_velocity_km_s: number;
  relativeVelocityKmS?: number; // Contract alias
  altitude_at_tca_km: number;
  altitudeAtTcaKm?: number; // Contract alias
  tle_epoch_age_hours: number;
  is_preliminary_screening: boolean;
  investigation_status: 'UNREVIEWED' | 'UNDER_EVALUATION' | 'MONITORING' | 'DISMISSED';
  data_source: DataSourceMetadata;
  dataSource?: 'real' | 'mock';
}

export interface TrajectoryPoint extends GeodeticCoordinate {
  timestamp: string;
  eci_x: number;
  eci_y: number;
  eci_z: number;
}

export interface SatelliteTrajectory {
  norad_id: number;
  name: string;
  epoch: string;
  period_minutes: number;
  points: TrajectoryPoint[];
}

export interface ScreeningQueryFilters {
  max_miss_distance_km?: number;
  window_hours?: number;
  orbit_regime?: OrbitRegime | 'ALL';
  object_type?: ObjectType | 'ALL';
  target_norad_id?: number;
}
