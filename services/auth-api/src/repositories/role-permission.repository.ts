/**
 * @file Data access for the `role_permissions` table.
 */

import type { PrismaClient } from "../generated/prisma/client";
import type { Role } from "../core/security/roles";

/**
 * Reads and changes the permissions granted to each role.
 */
export interface RolePermissionRepository {
  /**
   * @param role - Role to look up; `root` never has rows.
   * @returns The stored permission names of the role.
   */
  listByRole(role: Role): Promise<string[]>;

  /**
   * Grants a permission to a role; granting one it already holds changes nothing.
   *
   * @param role - Role receiving the permission.
   * @param permission - Permission granted.
   */
  grant(role: Role, permission: string): Promise<void>;

  /**
   * Revokes a permission from a role; revoking one it does not hold changes nothing.
   *
   * @param role - Role losing the permission.
   * @param permission - Permission revoked.
   */
  revoke(role: Role, permission: string): Promise<void>;
}

/**
 * Role permission repository backed by Prisma.
 */
export class PrismaRolePermissionRepository implements RolePermissionRepository {
  /**
   * @param client - Prisma client of the service.
   */
  constructor(private readonly client: PrismaClient) {}

  /**
   * @param role - Role to look up; `root` never has rows.
   * @returns The stored permission names of the role.
   */
  async listByRole(role: Role): Promise<string[]> {
    const rows: { permission: string }[] = await this.client.rolePermission.findMany({
      where: { role },
      select: { permission: true },
    });
    return rows.map((row) => row.permission);
  }

  /**
   * @param role - Role receiving the permission.
   * @param permission - Permission granted.
   */
  async grant(role: Role, permission: string): Promise<void> {
    await this.client.rolePermission.createMany({ data: [{ role, permission }], skipDuplicates: true });
  }

  /**
   * @param role - Role losing the permission.
   * @param permission - Permission revoked.
   */
  async revoke(role: Role, permission: string): Promise<void> {
    await this.client.rolePermission.deleteMany({ where: { role, permission } });
  }
}
