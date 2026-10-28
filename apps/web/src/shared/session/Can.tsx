import type { ReactNode } from "react";

import type { Permission } from "./types";
import { useSession } from "./useSession";

/**
 * Props of {@link Can}.
 */
interface CanProps {
  /** Permission required to render the children. */
  permission: Permission;
  /** Content shown only to accounts holding the permission. */
  children: ReactNode;
  /** Content shown instead to the rest, if any. */
  fallback?: ReactNode;
}

/**
 * Renders its children only when the signed in account holds a permission, so nobody sees an
 * action they cannot perform. The API checks the permission again on every request.
 *
 * @param props - Required permission, content and optional fallback.
 * @returns The content, the fallback or nothing.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useSession();
  return <>{can(permission) ? children : fallback}</>;
}
