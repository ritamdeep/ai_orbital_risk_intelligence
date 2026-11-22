/**
 * Backward compatibility re-export of API Client primitives
 */
export {
  apiFetch as fetchFromApi,
  FORCE_MOCK_MODE as USE_MOCK_DATA,
  ORBITAL_API_BASE,
  MISSION_API_BASE,
  ApiError,
} from '../api/client';
