import type { Role } from "./types";

/**
 * Name of each role as the workshop says it.
 */
export const ROLE_LABELS: Record<Role, string> = {
  root: "Superadministrador",
  admin: "Administrador",
  user: "Operativo",
};
