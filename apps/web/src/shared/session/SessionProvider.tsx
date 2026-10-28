import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { toApiError } from "@shared/api/errors";
import { acceptSession, endSession, refreshSession, sessionHttp } from "@shared/api/http";

import { SessionContext, type LoginCredentials, type SessionContextValue, type SessionStatus } from "./session-context";
import { subscribeSession } from "./session-events";
import { accessTokenRemainingMs } from "./token-store";
import type { Permission, Profile, SessionResponse } from "./types";

/**
 * How long before the access token expires the session is renewed, in milliseconds.
 */
const RENEW_BEFORE_MS = 60_000;

/**
 * Props of {@link SessionProvider}.
 */
interface SessionProviderProps {
  /** The app. */
  children: ReactNode;
}

/**
 * Holds the session of the app.
 *
 * On load it tries to recover a session through the httpOnly refresh cookie, then renews the
 * access token a minute before it expires. Renewals triggered by a request that got a 401 also
 * reach it, through the session events.
 *
 * @param props - The app.
 * @returns The provider.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    return subscribeSession({
      renewed: (next) => {
        setProfile(next);
        setStatus("authenticated");
      },
      ended: () => {
        setProfile(null);
        setStatus("anonymous");
      },
    });
  }, []);

  useEffect(() => {
    refreshSession().catch(() => endSession());
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    const delay: number = Math.max(5_000, accessTokenRemainingMs() - RENEW_BEFORE_MS);
    const timer: number = window.setTimeout(() => {
      refreshSession().catch(() => endSession());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [status, profile]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await sessionHttp.post<SessionResponse>("/login", {
        email: credentials.email,
        password: credentials.password,
        turnstile_token: credentials.turnstileToken || undefined,
      });
      acceptSession(response.data);
    } catch (error: unknown) {
      throw toApiError(error, {
        unauthorized: "El correo o la contraseña no son correctos.",
        too_many_requests: "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.",
      });
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await sessionHttp.post("/logout");
    } finally {
      endSession();
    }
  }, []);

  const can = useCallback(
    (permission: Permission): boolean => profile?.role === "root" || (profile?.permissions.includes(permission) ?? false),
    [profile],
  );

  const value: SessionContextValue = useMemo(
    () => ({ status, profile, login, logout, can }),
    [status, profile, login, logout, can],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
