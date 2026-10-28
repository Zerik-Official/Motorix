/**
 * @file Path parameters and response shape of the role permission endpoints.
 */

import { z } from "zod";

import type { Permission } from "../core/security/permissions";
import { ROLES, type Role } from "../core/security/roles";

/**
 * Path parameters of `PUT` and `DELETE /api/v1/roles/{role}/permissions/{permission}`.
 */
export const rolePermissionParamsSchema = z.object({
  role: z.enum(ROLES),
  permission: z.string().min(1).max(64),
});

/**
 * Representation of a role returned by the API.
 */
export interface RoleResponse {
  role: Role;
  permissions: Permission[];
  editable: boolean;
}

/**
 * Body of `GET /api/v1/roles`.
 */
export interface RoleListResponse {
  catalog: Permission[];
  roles: RoleResponse[];
}
