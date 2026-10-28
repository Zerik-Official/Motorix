/**
 * @file Identity of the authenticated account making a request.
 */

import type { Permission } from "./permissions";
import type { Role } from "./roles";

/**
 * Account behind a request, with its role and permissions as stored right now.
 */
export interface Caller {
  id: string;
  role: Role;
  permissions: readonly Permission[];
}
