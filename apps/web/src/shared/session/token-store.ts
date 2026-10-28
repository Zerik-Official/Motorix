/**
 * Access token of the session, kept only in the memory of this page.
 *
 * It is never written to `localStorage`, `sessionStorage` or a readable cookie, so a script
 * injected into the page finds nothing stored to steal; a reload recovers it through the
 * httpOnly refresh cookie.
 */
interface AccessTokenState {
  token: string;
  expiresAt: number;
}

let current: AccessTokenState | null = null;

/**
 * Stores the access token of the session.
 *
 * @param token - Signed JWT.
 * @param expiresAt - Moment it expires, as an ISO date.
 */
export function setAccessToken(token: string, expiresAt: string): void {
  current = { token, expiresAt: new Date(expiresAt).getTime() };
}

/**
 * Reads the access token of the session.
 *
 * @returns The token, or null when there is no session.
 */
export function getAccessToken(): string | null {
  return current?.token ?? null;
}

/**
 * Tells how long the access token remains valid.
 *
 * @returns Milliseconds until it expires, or 0 when there is none.
 */
export function accessTokenRemainingMs(): number {
  return current ? Math.max(0, current.expiresAt - Date.now()) : 0;
}

/**
 * Forgets the access token.
 */
export function clearAccessToken(): void {
  current = null;
}
