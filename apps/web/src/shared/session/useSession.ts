import { useContext } from "react";

import { SessionContext, type SessionContextValue } from "./session-context";

/**
 * Reads the session of the app.
 *
 * @returns The session.
 * @throws Error When used outside `SessionProvider`.
 */
export function useSession(): SessionContextValue {
  const value: SessionContextValue | null = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
