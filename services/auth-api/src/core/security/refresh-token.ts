/**
 * @file Opaque refresh tokens: random values handed to the browser in a cookie, stored only as a hash.
 */

import { createHash, randomBytes } from "node:crypto";

/**
 * Name of the cookie that carries the refresh token.
 */
export const REFRESH_COOKIE_NAME = "motorix_refresh";

/**
 * Path the cookie is limited to, so the browser only sends it to the session endpoints.
 */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/**
 * Generates a new refresh token with 256 bits of randomness.
 *
 * @returns The token, base64url encoded.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes a refresh token for storage and lookup.
 *
 * A fast hash is enough here: the token is random and long, so it cannot be guessed from its hash,
 * unlike a password.
 *
 * @param token - Refresh token sent by the browser.
 * @returns The SHA-256 hex digest.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
