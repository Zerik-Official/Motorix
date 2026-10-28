/**
 * @file Resolution, granting and revocation of the permissions an account holds through its role.
 */

import { log } from "../core/logging";
import type { Caller } from "../core/security/caller";
import {
  assertCanChangePermission,
  normalizePermissions,
  PERMISSIONS,
  type Permission,
} from "../core/security/permissions";
import { outranks, ROLES, type Role } from "../core/security/roles";
import type { RolePermissionRepository } from "../repositories/role-permission.repository";

/**
 * Permissions of a role, and whether the caller may change them.
 */
export interface RolePermissions {
  role: Role;
  permissions: Permission[];
  editable: boolean;
}

/**
 * Resolves and changes the current permissions of each role.
 */
export class PermissionService {
  /**
   * @param rolePermissions - Stored permissions of each role.
   */
  constructor(private readonly rolePermissions: RolePermissionRepository) {}

  /**
   * Lists the permissions a role holds right now.
   *
   * @param role - Role to resolve.
   * @returns Every permission for `root`, which is never read from storage; the stored ones otherwise.
   */
  async resolve(role: Role): Promise<Permission[]> {
    if (role === "root") {
      return [...PERMISSIONS];
    }
    return normalizePermissions(await this.rolePermissions.listByRole(role));
  }

  /**
   * Describes every role as seen by the caller.
   *
   * @param caller - Account asking.
   * @returns Each role with its permissions and whether the caller may change them.
   */
  async listRoles(caller: Caller): Promise<RolePermissions[]> {
    return Promise.all(ROLES.map((role) => this.describe(caller, role)));
  }

  /**
   * Grants a permission to a role below the caller's, if the caller holds it.
   *
   * @param caller - Account making the change.
   * @param role - Role receiving the permission.
   * @param permission - Permission granted.
   * @returns The role with its updated permissions.
   * @throws PermissionDeniedError When a rule of `assertCanChangePermission` is broken.
   * @throws ValidationError When the permission is not in the catalog.
   */
  async grant(caller: Caller, role: Role, permission: string): Promise<RolePermissions> {
    assertCanChangePermission(caller, role, permission);
    await this.rolePermissions.grant(role, permission);
    log("INFO", `Permission '${permission}' granted to '${role}' by ${caller.id}`);
    return this.describe(caller, role);
  }

  /**
   * Revokes a permission from a role below the caller's, if the caller holds it.
   *
   * @param caller - Account making the change.
   * @param role - Role losing the permission.
   * @param permission - Permission revoked.
   * @returns The role with its updated permissions.
   * @throws PermissionDeniedError When a rule of `assertCanChangePermission` is broken.
   * @throws ValidationError When the permission is not in the catalog.
   */
  async revoke(caller: Caller, role: Role, permission: string): Promise<RolePermissions> {
    assertCanChangePermission(caller, role, permission);
    await this.rolePermissions.revoke(role, permission);
    log("INFO", `Permission '${permission}' revoked from '${role}' by ${caller.id}`);
    return this.describe(caller, role);
  }

  /**
   * @param caller - Account asking.
   * @param role - Role to describe.
   * @returns The role with its current permissions and whether the caller may change them.
   */
  private async describe(caller: Caller, role: Role): Promise<RolePermissions> {
    return {
      role,
      permissions: await this.resolve(role),
      editable: caller.permissions.includes("permissions:manage") && outranks(caller.role, role),
    };
  }
}
