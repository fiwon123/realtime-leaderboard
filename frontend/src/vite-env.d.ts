/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base URL; empty (same origin, via the dev proxy) when unset. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
