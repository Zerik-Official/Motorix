import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useSession } from "@shared/session/useSession";

import { FullScreenLoader } from "./FullScreenLoader";

/**
 * Props of {@link ProtectedRoute}.
 */
interface ProtectedRouteProps {
  /** Content reserved to signed in accounts. */
  children: ReactNode;
}

/**
 * Shows its content only with an open session; otherwise sends the person to the login,
 * remembering the page they wanted.
 *
 * @param props - Protected content.
 * @returns The content, the loader while the session is recovered, or a redirect.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return <FullScreenLoader label="Recuperando tu sesión" />;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}
