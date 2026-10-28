/**
 * @file Resolution of the permissions an account holds through its role.
 */

import { normalizePermissions, PERMISSIONS, type Permission } from "../core/security/permissions";
import type { Role } from "../core/security/roles";
import type { RolePermissionRepository } from "../repositories/role-permission.repository";

/**
 * Resolves the current permissions of each role.
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
}
