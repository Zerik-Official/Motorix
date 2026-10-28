import type { Role } from "./types";

/**
 * Name of each role as the workshop says it.
 */
export const ROLE_LABELS: Record<Role, string> = {
  root: "Superadministrador",
  admin: "Administrador",
  user: "Operativo",
};

/**
 * Position of each role in the hierarchy; a higher rank manages the lower ones.
 */
const ROLE_RANK: Record<Role, number> = {
  root: 3,
  admin: 2,
  user: 1,
};

/**
 * Tells whether a role sits strictly above another one, the rule both APIs apply to manage
 * accounts and permissions.
 *
 * @param actor - Role of the account acting.
 * @param target - Role being acted upon.
 * @returns True when `actor` outranks `target`.
 */
export function outranks(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
