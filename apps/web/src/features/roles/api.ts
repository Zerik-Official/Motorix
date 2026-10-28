import { authApi } from "@shared/api/http";
import type { Permission, Role } from "@shared/session/types";

/**
 * Permissions a role holds, and whether the signed in account may change them.
 */
export interface RolePermissions {
  role: Role;
  permissions: Permission[];
  editable: boolean;
}

/**
 * Catalog of permissions and every role with the ones it holds.
 */
export interface RoleList {
  catalog: Permission[];
  roles: RolePermissions[];
}

/**
 * Fetches every role with its permissions.
 *
 * @returns The catalog and the roles.
 */
export async function fetchRoles(): Promise<RoleList> {
  return (await authApi.get<RoleList>("/roles")).data;
}

/**
 * Grants or revokes one permission of a role.
 *
 * @param role - Role to change.
 * @param permission - Permission to grant or revoke.
 * @param granted - True to grant it, false to revoke it.
 * @returns The role with its updated permissions.
 */
export async function setRolePermission(role: Role, permission: Permission, granted: boolean): Promise<RolePermissions> {
  const url: string = `/roles/${role}/permissions/${encodeURIComponent(permission)}`;
  const response = granted ? await authApi.put<RolePermissions>(url) : await authApi.delete<RolePermissions>(url);
  return response.data;
}

/**
 * Key of one cell of the matrix.
 *
 * @param role - Role of the column.
 * @param permission - Permission of the row.
 * @returns The key.
 */
export function cellKey(role: Role, permission: Permission): string {
  return `${role}:${permission}`;
}
