/**
 * @file HTTP helpers shared by the end-to-end tests, which talk to both running services.
 */

/**
 * Base URL of auth-api, from `AUTH_API_URL`.
 */
export const AUTH_URL: string = process.env.AUTH_API_URL ?? "http://localhost:3000";

/**
 * Base URL of business-api, from `BUSINESS_API_URL`.
 */
export const BUSINESS_URL: string = process.env.BUSINESS_API_URL ?? "http://localhost:8000";

/**
 * Credentials of the `root` account seeded by auth-api.
 */
export const ROOT = {
  email: process.env.ROOT_EMAIL ?? "root@motorix.local",
  password: process.env.ROOT_PASSWORD ?? "change-me-root-password",
};

/**
 * Suffix that keeps the data of each run apart, so the suite can run against a database already in use.
 */
export const RUN_ID: string = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Status and parsed body of a response.
 */
export interface ApiResponse<BodyT = any> {
  status: number;
  body: BodyT;
}

/**
 * Sends a JSON request.
 *
 * @param method - HTTP method.
 * @param url - Absolute URL.
 * @param token - Bearer token, if the endpoint is protected.
 * @param body - JSON body, if any.
 * @returns The status and the parsed body, or null for an empty body.
 */
export async function call<BodyT = any>(
  method: string,
  url: string,
  token?: string,
  body?: unknown,
): Promise<ApiResponse<BodyT>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response: Response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text: string = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

/**
 * Logs in through auth-api.
 *
 * @param email - Email of the account.
 * @param password - Password of the account.
 * @returns The access token.
 * @throws Error When the login does not answer 200.
 */
export async function login(email: string, password: string): Promise<string> {
  const response: ApiResponse = await call("POST", `${AUTH_URL}/api/v1/auth/login`, undefined, { email, password });
  if (response.status !== 200) {
    throw new Error(`Login of ${email} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return response.body.access_token;
}

/**
 * Encodes bytes or text as base64url.
 *
 * @param value - Bytes or text.
 * @returns The base64url encoding.
 */
function base64url(value: ArrayBuffer | string): string {
  const bytes: Buffer = typeof value === "string" ? Buffer.from(value) : Buffer.from(new Uint8Array(value));
  return bytes.toString("base64url");
}

/**
 * Signs a well-formed RS256 token with a key auth-api does not own, to prove business-api checks signatures.
 *
 * @param claims - Claims of the token.
 * @returns The forged token.
 */
export async function forgeToken(claims: Record<string, unknown>): Promise<string> {
  const keys: CryptoKeyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const unsigned: string = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const signature: ArrayBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, Buffer.from(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

/**
 * Reads the claims of a token without verifying it, to build forged copies of real tokens.
 *
 * @param token - Encoded JWT.
 * @returns Its payload.
 */
export function decodeClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
}
