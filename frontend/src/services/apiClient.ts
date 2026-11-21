/**
 * Base API Client for ASTRAVIGIL
 * Configured to connect to FastAPI backend with automatic fallback to mock data
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true' || true;

export async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error [${response.status}] ${response.statusText} at ${endpoint}`);
  }

  return response.json() as Promise<T>;
}
