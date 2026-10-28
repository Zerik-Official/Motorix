/**
 * @file Data access for the `role_permissions` table.
 */

import type { PrismaClient } from "../generated/prisma/client";
import type { Role } from "../core/security/roles";

/**
 * Reads the permissions granted to each role.
 */
export interface RolePermissionRepository {
  /**
   * @param role - Role to look up; `root` never has rows.
   * @returns The stored permission names of the role.
   */
  listByRole(role: Role): Promise<string[]>;
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
}
