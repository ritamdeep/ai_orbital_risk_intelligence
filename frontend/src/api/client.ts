/**
 * ASTRAVIGIL Shared API Client Wrapper
 *
 * Implements:
 * - Configurable base URLs from VITE_ORBITAL_API_URL and VITE_MISSION_API_URL
 * - Standard 8s timeout with AbortController (configurable per-call, e.g. 20s for AI briefing)
 * - Typed ApiError with machine-readable codes and status
 * - Strict security: zero credential or secret logging
 * - Support for VITE_USE_MOCK=true local testing override
 */

export const ORBITAL_API_BASE =
  import.meta.env.VITE_ORBITAL_API_URL || 'http://localhost:8000';

export const MISSION_API_BASE =
  import.meta.env.VITE_MISSION_API_URL || 'http://localhost:8001';

export const FORCE_MOCK_MODE =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  import.meta.env.VITE_USE_MOCK_DATA === 'true';

export class ApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isTimeout: boolean;
  readonly isNetworkError: boolean;

  constructor(params: {
    message: string;
    status?: number;
    code?: string;
    details?: unknown;
    isTimeout?: boolean;
    isNetworkError?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code || (params.status ? `HTTP_${params.status}` : 'UNKNOWN_ERROR');
    this.details = params.details;
    this.isTimeout = Boolean(params.isTimeout);
    this.isNetworkError = Boolean(params.isNetworkError);
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Executes an HTTP fetch with AbortController timeout and typed error normalization.
 */
export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  if (FORCE_MOCK_MODE) {
    throw new ApiError({
      message: 'Mock mode forced by VITE_USE_MOCK=true',
      code: 'MOCK_FORCED',
    });
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If caller supplied their own signal, listen to it as well
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorPayload: any = null;
      try {
        errorPayload = await response.json();
      } catch {
        // Non-JSON response
      }

      const backendCode =
        errorPayload?.error?.code ||
        errorPayload?.code ||
        `HTTP_${response.status}`;
      const backendMessage =
        errorPayload?.error?.message ||
        errorPayload?.detail ||
        `Request to ${response.url} failed with status ${response.status}`;

      throw new ApiError({
        message: typeof backendMessage === 'string' ? backendMessage : JSON.stringify(backendMessage),
        status: response.status,
        code: backendCode,
        details: errorPayload?.error?.details || errorPayload?.detail,
      });
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new ApiError({
        message: `Request timed out after ${timeoutMs}ms`,
        code: 'TIMEOUT',
        isTimeout: true,
      });
    }

    throw new ApiError({
      message: error?.message || 'Network connection failed',
      code: 'NETWORK_ERROR',
      isNetworkError: true,
    });
  }
}
