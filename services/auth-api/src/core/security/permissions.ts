/**
 * @file Permission catalog and the rules that decide who may grant or revoke a permission.
 */

import { PermissionDeniedError, ValidationError } from "../errors";
import { outranks, type Role } from "./roles";

/**
 * Every permission an account can hold, as `resource:action`.
 */
export const PERMISSIONS = [
  "clients:read",
  "clients:write",
  "engines:read",
  "engines:write",
  "repair_orders:read",
  "repair_orders:write",
  "users:manage",
  "permissions:manage",
] as const;

/**
 * Operation an account may be allowed to perform.
 */
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Tells whether a text is a permission of the catalog.
 *
 * @param value - Text to check.
 * @returns True for a known permission.
 */
export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Keeps the known permissions of a list, in catalog order and without duplicates.
 *
 * @param values - Stored permission names.
 * @returns The permissions of the catalog found in `values`.
 */
export function normalizePermissions(values: Iterable<string>): Permission[] {
  const present: Set<string> = new Set(values);
  return PERMISSIONS.filter((permission) => present.has(permission));
}

/**
 * Account that tries to change the permissions of a role.
 */
export interface PermissionActor {
  role: Role;
  permissions: readonly Permission[];
}

/**
 * Checks that an account may grant or revoke a permission of a role.
 *
 * The account must hold `permissions:manage`, the target role must sit strictly below its own
 * (so nobody changes their own role, a higher one, or `root`), and it can only hand over or take
 * away a permission it holds itself.
 *
 * @param actor - Account making the change.
 * @param targetRole - Role whose permissions change.
 * @param permission - Permission granted or revoked.
 * @throws ValidationError When the permission is not in the catalog.
 * @throws PermissionDeniedError When any of the rules above is broken.
 */
export function assertCanChangePermission(actor: PermissionActor, targetRole: Role, permission: string): void {
  if (!isPermission(permission)) {
    throw new ValidationError(`Unknown permission '${permission}'`, { permission });
  }
  if (!actor.permissions.includes("permissions:manage")) {
    throw new PermissionDeniedError("Managing permissions requires 'permissions:manage'");
  }
  if (!outranks(actor.role, targetRole)) {
    throw new PermissionDeniedError(`A '${actor.role}' cannot change the permissions of '${targetRole}'`);
  }
  if (!actor.permissions.includes(permission)) {
    throw new PermissionDeniedError(`Only a permission you hold can be granted or revoked: '${permission}'`);
  }
}
