import { SpaceObjectSummary, ConjunctionEvent, SatelliteTrajectory, ScreeningQueryFilters } from '../types/orbital';
import { InvestigationStatus } from '../types/common';
import { fetchFromApi, USE_MOCK_DATA } from './apiClient';
import { MOCK_SPACE_OBJECTS } from './mock/mockSatellites';
import { MOCK_CONJUNCTIONS as CONJUNCTIONS_LIST } from './mock/mockConjunctions';

export const orbitalService = {
  /**
   * Fetch all tracked orbital objects (active payloads and catalogued debris)
   */
  async getTrackedObjects(): Promise<SpaceObjectSummary[]> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 120));
      return MOCK_SPACE_OBJECTS;
    }
    return fetchFromApi<SpaceObjectSummary[]>('/orbital/objects');
  },

  /**
   * Fetch preliminary close-approach screening events within the forecast window
   */
  async getCloseApproachEvents(filters?: ScreeningQueryFilters): Promise<ConjunctionEvent[]> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 150));
      let results = [...CONJUNCTIONS_LIST];

      if (filters?.max_miss_distance_km) {
        results = results.filter(e => e.miss_distance_km <= (filters.max_miss_distance_km || 100));
      }
      if (filters?.target_norad_id) {
        results = results.filter(e => e.primary_object.norad_id === filters.target_norad_id);
      }
      return results;
    }

    const params = new URLSearchParams();
    if (filters?.max_miss_distance_km) params.append('max_miss_distance_km', String(filters.max_miss_distance_km));
    if (filters?.window_hours) params.append('window_hours', String(filters.window_hours));
    if (filters?.target_norad_id) params.append('target_norad_id', String(filters.target_norad_id));

    return fetchFromApi<ConjunctionEvent[]>(`/orbital/screen?${params.toString()}`);
  },

  /**
   * Fetch orbital trajectory sample points for 3D Globe representation
   */
  async getSatelliteTrajectory(noradId: number): Promise<SatelliteTrajectory> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 100));
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
        
        // Simple ECI spherical approximation for 3D vector points
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
    }

    return fetchFromApi<SatelliteTrajectory>(`/orbital/trajectory/${noradId}`);
  },

  /**
   * Update operational investigation status of a conjunction alert
   */
  async updateInvestigationStatus(conjunctionId: string, status: InvestigationStatus): Promise<boolean> {
    if (USE_MOCK_DATA) {
      const target = CONJUNCTIONS_LIST.find(c => c.conjunction_id === conjunctionId);
      if (target) {
        target.investigation_status = status;
      }
      return true;
    }

    return fetchFromApi<boolean>(`/orbital/conjunctions/${conjunctionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
};
