/**
 * @file Request schemas and response shape of the user endpoints.
 */

import { z } from "zod";

import type { Permission } from "../core/security/permissions";
import { ROLES, type Role } from "../core/security/roles";
import type { UserRecord } from "../repositories/user.repository";

/**
 * Roles that can be assigned through the API; `root` only comes from the environment.
 */
const ASSIGNABLE_ROLES = ROLES.filter((role): role is Exclude<Role, "root"> => role !== "root") as [
  Exclude<Role, "root">,
  ...Exclude<Role, "root">[],
];

const email = z.email().max(255).transform((value) => value.trim().toLowerCase());
const fullName = z.string().trim().min(1).max(150);
const password = z.string().min(8).max(128);

/**
 * Body of `POST /api/v1/users`.
 */
export const userCreateSchema = z.strictObject({
  email,
  full_name: fullName,
  password,
  role: z.enum(ASSIGNABLE_ROLES).default("user"),
});

/**
 * Body of `PUT /api/v1/users/{id}`; `password` is optional and resets it when sent.
 */
export const userUpdateSchema = z.strictObject({
  email,
  full_name: fullName,
  role: z.enum(ASSIGNABLE_ROLES),
  is_active: z.boolean(),
  password: password.optional(),
});

/**
 * Body of `PUT /api/v1/users/me/password`.
 */
export const passwordChangeSchema = z.strictObject({
  current_password: z.string().min(1).max(128),
  new_password: password,
});

/**
 * Query of `GET /api/v1/users`.
 */
export const userListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(255).optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.stringbool().optional(),
});

/**
 * Path parameter of the endpoints that target one account.
 */
export const userIdSchema = z.uuid();

/**
 * Validated body of `POST /api/v1/users`.
 */
export type UserCreateInput = z.infer<typeof userCreateSchema>;

/**
 * Validated body of `PUT /api/v1/users/{id}`.
 */
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/**
 * Validated body of `PUT /api/v1/users/me/password`.
 */
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Validated query of `GET /api/v1/users`.
 */
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;

/**
 * Representation of an account returned by the API; it never includes the password hash.
 */
export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Representation of the caller's own account, with the permissions its role holds right now.
 */
export interface ProfileResponse extends UserResponse {
  permissions: Permission[];
}

/**
 * One page of an offset paginated listing.
 */
export interface Page<ItemT> {
  items: ItemT[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Converts a stored account to its API representation.
 *
 * @param user - Stored account.
 * @returns The account without its password hash.
 */
export function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    is_active: user.isActive,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}
