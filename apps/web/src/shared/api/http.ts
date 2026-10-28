import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { env } from "@shared/config/env";
import { clearAccessToken, getAccessToken, setAccessToken } from "@shared/session/token-store";
import { emitEnded, emitRenewed } from "@shared/session/session-events";
import type { SessionResponse } from "@shared/session/types";

import { toApiError } from "./errors";

/**
 * Name of the Web Lock that serializes refreshes across every tab of the app.
 */
const REFRESH_LOCK = "motorix-session-refresh";

/**
 * Request timeout of every call, in milliseconds.
 */
const TIMEOUT_MS = 15000;

/**
 * Client of the session endpoints of auth-api; it sends the httpOnly refresh cookie.
 */
export const sessionHttp: AxiosInstance = axios.create({
  baseURL: `${env.authApiUrl}/api/v1/auth`,
  withCredentials: true,
  timeout: TIMEOUT_MS,
});

let inFlight: Promise<SessionResponse> | null = null;

/**
 * Runs a task holding the cross-tab refresh lock, or directly in browsers without Web Locks.
 *
 * Two tabs refreshing with the same cookie at once would look like a stolen token to auth-api,
 * which ends the session; the lock makes the second tab wait and send the rotated cookie instead.
 *
 * @param task - Work to run while holding the lock.
 * @returns The result of the task.
 */
function withRefreshLock<ResultT>(task: () => Promise<ResultT>): Promise<ResultT> {
  if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task) as Promise<ResultT>;
  }
  return task();
}

/**
 * Stores a session returned by login or refresh and tells the listeners.
 *
 * @param session - Session returned by auth-api.
 * @returns The same session.
 */
export function acceptSession(session: SessionResponse): SessionResponse {
  setAccessToken(session.access_token, session.expires_at);
  emitRenewed(session.user);
  return session;
}

/**
 * Renews the access token with the refresh cookie; concurrent calls share one request.
 *
 * @returns The renewed session.
 * @throws ApiError When the session has ended.
 */
export function refreshSession(): Promise<SessionResponse> {
  inFlight ??= withRefreshLock(async () => {
    const response = await sessionHttp.post<SessionResponse>("/refresh");
    return acceptSession(response.data);
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Forgets the session locally and tells the listeners.
 */
export function endSession(): void {
  clearAccessToken();
  emitEnded();
}

/**
 * Request config marked once it has been retried after a refresh.
 */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Creates the client of a protected API: it sends the access token and, on a 401, renews the
 * session once and repeats the request. Every failure reaches the caller as an `ApiError`.
 *
 * @param baseURL - Base URL of the API.
 * @returns The client.
 */
export function createApiClient(baseURL: string): AxiosInstance {
  const client: AxiosInstance = axios.create({ baseURL, timeout: TIMEOUT_MS });
  client.interceptors.request.use((config) => {
    const token: string | null = getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });
  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true;
      try {
        await refreshSession();
      } catch {
        endSession();
        return Promise.reject(toApiError(error));
      }
      return client.request(config);
    }
    return Promise.reject(toApiError(error));
  });
  return client;
}

/**
 * Client of the protected endpoints of auth-api (users and roles).
 */
export const authApi: AxiosInstance = createApiClient(`${env.authApiUrl}/api/v1`);

/**
 * Client of business-api (clients, engines and repair orders).
 */
export const businessApi: AxiosInstance = createApiClient(`${env.businessApiUrl}/api/v1`);
