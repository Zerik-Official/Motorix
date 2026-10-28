import { createContext } from "react";

import type { Permission, Profile } from "./types";

/**
 * Credentials typed on the login form.
 */
export interface LoginCredentials {
  email: string;
  password: string;
  /** Token of the Turnstile widget, when it is enabled. */
  turnstileToken?: string;
}

/**
 * Stage of the session: being recovered on load, open, or closed.
 */
export type SessionStatus = "loading" | "authenticated" | "anonymous";

/**
 * Session shared by the whole app.
 */
export interface SessionContextValue {
  /** Stage of the session. */
  status: SessionStatus;
  /** Account of the signed in person, or null. */
  profile: Profile | null;
  /**
   * Opens a session.
   *
   * @param credentials - Email, password and Turnstile token.
   * @returns Resolves once the session is open.
   */
  login: (credentials: LoginCredentials) => Promise<void>;
  /**
   * Ends the session on the server and locally.
   *
   * @returns Resolves once the session is closed.
   */
  logout: () => Promise<void>;
  /**
   * Tells whether the signed in account holds a permission.
   *
   * @param permission - Permission to check.
   * @returns True when the account holds it.
   */
  can: (permission: Permission) => boolean;
}

/**
 * Context of the session; read it through `useSession`.
 */
export const SessionContext = createContext<SessionContextValue | null>(null);
