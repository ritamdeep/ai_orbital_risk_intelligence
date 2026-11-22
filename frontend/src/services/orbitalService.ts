import { SpaceObjectSummary, ConjunctionEvent, SatelliteTrajectory, ScreeningQueryFilters } from '../types/orbital';
import { InvestigationStatus } from '../types/common';
import { orbitalApi } from '../api/orbitalApi';
import { adaptOrbitalToSpaceObject, adaptConjunctionEvent } from '../api/adapters';
import { MOCK_SPACE_OBJECTS } from './mock/mockSatellites';
import { MOCK_CONJUNCTIONS } from './mock/mockConjunctions';
import { FORCE_MOCK_MODE } from '../api/client';

export const orbitalService = {
  /**
   * Fetch all tracked orbital objects (active payloads and catalogued debris)
   */
  async getTrackedObjects(): Promise<SpaceObjectSummary[]> {
    if (FORCE_MOCK_MODE) {
      return MOCK_SPACE_OBJECTS;
    }
    try {
      const dtos = await orbitalApi.getSatellites();
      if (dtos && dtos.length > 0) {
        return dtos.map(adaptOrbitalToSpaceObject);
      }
      return MOCK_SPACE_OBJECTS;
    } catch {
      return MOCK_SPACE_OBJECTS;
    }
  },

  /**
   * Fetch preliminary close-approach screening events within the forecast window
   */
  async getCloseApproachEvents(filters?: ScreeningQueryFilters): Promise<ConjunctionEvent[]> {
    if (FORCE_MOCK_MODE) {
      return MOCK_CONJUNCTIONS;
    }
    try {
      const dtos = await orbitalApi.getConjunctions({
        windowHours: filters?.window_hours ?? 168,
        maxSeparationKm: filters?.max_miss_distance_km ?? 200,
      });
      if (dtos && dtos.length > 0) {
        return dtos.map(adaptConjunctionEvent);
      }
      return MOCK_CONJUNCTIONS;
    } catch {
      return MOCK_CONJUNCTIONS;
    }
  },

  /**
   * Fetch orbital trajectory sample points for 3D Globe representation
   */
  async getSatelliteTrajectory(noradId: number): Promise<SatelliteTrajectory> {
    const obj = MOCK_SPACE_OBJECTS.find(o => o.norad_id === noradId) || MOCK_SPACE_OBJECTS[0];
    
    // Generate realistic elliptical orbital points for 3D globe visualization
    const points = [];
    const numPoints = 120;
    const periodSec = obj.period_min * 60;
    const baseAlt = obj.perigee_km;

    for (let i = 0; i < numPoints; i++) {
      const theta = (i / numPoints) * 2 * Math.PI;
      const lat = Math.sin(theta) * obj.inclination_deg;
      const lon = (((theta * 180 / Math.PI) + (obj.current_position.longitude || 0)) % 360) - 180;
      const alt = baseAlt + Math.sin(theta * 2) * (obj.apogee_km - obj.perigee_km);
      
      const r = 6371 + alt;
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const x = r * Math.cos(latRad) * Math.cos(lonRad);
      const y = r * Math.sin(latRad);
      const z = r * Math.cos(latRad) * Math.sin(lonRad);

      points.push({
        latitude: lat,
        longitude: lon,
        altitude_km: alt,
        eci_x: x,
        eci_y: y,
        eci_z: z,
        timestamp: new Date(Date.now() + (i / numPoints) * periodSec * 1000).toISOString(),
      });
    }

    return {
      norad_id: obj.norad_id,
      name: obj.name,
      epoch: obj.tle_epoch,
      period_minutes: obj.period_min,
      points,
    };
  },

  /**
   * Update operational investigation status of a conjunction alert
   */
  async updateInvestigationStatus(conjunctionId: string, status: InvestigationStatus): Promise<boolean> {
    try {
      localStorage.setItem(`astravigil_status_${conjunctionId}`, status);
      return true;
    } catch {
      return false;
    }
  }
};
