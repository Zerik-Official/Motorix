/// <reference types="vite/client" />

/**
 * Variables of the web app read at build time.
 */
interface ImportMetaEnv {
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_BUSINESS_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_SITE_URL?: string;
}

/**
 * Metadata of the module, with the typed variables.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
