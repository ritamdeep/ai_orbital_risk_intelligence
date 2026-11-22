/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORBITAL_API_URL?: string;
  readonly VITE_MISSION_API_URL?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_USE_MOCK_DATA?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
