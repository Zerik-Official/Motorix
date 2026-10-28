/**
 * Settings of the web app, read from the `VITE_*` variables at build time.
 */
export interface WebEnv {
  /** Base URL of auth-api. */
  authApiUrl: string;
  /** Base URL of business-api. */
  businessApiUrl: string;
  /** Public Cloudflare Turnstile site key; empty disables the widget. */
  turnstileSiteKey: string;
}

/**
 * Removes the trailing slash of a URL, so paths can be appended safely.
 *
 * @param value - URL read from the environment.
 * @param fallback - URL used when the variable is missing.
 * @returns The URL without a trailing slash.
 */
function baseUrl(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/+$/, "");
}

/**
 * Settings of the running build.
 */
export const env: WebEnv = {
  authApiUrl: baseUrl(import.meta.env.VITE_AUTH_API_URL, "http://localhost:3000"),
  businessApiUrl: baseUrl(import.meta.env.VITE_BUSINESS_API_URL, "http://localhost:8000"),
  turnstileSiteKey: (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim(),
};
