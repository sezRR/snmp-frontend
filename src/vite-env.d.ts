/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** Path the API is reached under. Empty talks to it directly; "/api" is
   *  what the production reverse proxy routes. Defaults to "/api". */
  readonly VITE_API_PREFIX?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
