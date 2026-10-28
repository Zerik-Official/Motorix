import { authApi } from "@shared/api/http";
import { isActiveParam, type ActiveFilter, type OffsetPage } from "@shared/api/pagination";
import type { Profile, Role } from "@shared/session/types";

/**
 * Account as auth-api lists it, without the permissions of its role.
 */
export type User = Omit<Profile, "permissions">;

/**
 * Roles that can be given through the API; `root` only comes from the environment.
 */
export type AssignableRole = Exclude<Role, "root">;

/**
 * Fields an account is created with.
 */
export interface NewUserFields {
  email: string;
  full_name: string;
  password: string;
  role: AssignableRole;
}

/**
 * Fields an account is edited with; an edit replaces all of them, and the password is only
 * reset when sent.
 */
export interface UserFields {
  email: string;
  full_name: string;
  role: AssignableRole;
  is_active: boolean;
  password?: string;
}

/**
 * Filters of the account listing.
 */
export interface UserFilters {
  search?: string;
  role?: Role;
  active: ActiveFilter;
}

/**
 * How many accounts each page of the listing brings.
 */
export const USER_PAGE_SIZE = 20;

/**
 * Fetches one page of accounts, newest first.
 *
 * @param filters - Search, role and active filter.
 * @param page - Page to fetch, starting at 1.
 * @returns The page with the total of matching accounts.
 */
export async function fetchUsers(filters: UserFilters, page: number): Promise<OffsetPage<User>> {
  const response = await authApi.get<OffsetPage<User>>("/users", {
    params: {
      search: filters.search || undefined,
      role: filters.role || undefined,
      is_active: isActiveParam(filters.active),
      limit: USER_PAGE_SIZE,
      offset: (page - 1) * USER_PAGE_SIZE,
    },
  });
  return response.data;
}

/**
 * Creates an account.
 *
 * @param fields - Fields of the account.
 * @returns The created account.
 */
export async function createUser(fields: NewUserFields): Promise<User> {
  return (await authApi.post<User>("/users", fields)).data;
}

/**
 * Replaces the fields of an account.
 *
 * @param id - Identifier of the account.
 * @param fields - New values of every field, and a new password if it is reset.
 * @returns The updated account.
 */
export async function updateUser(id: string, fields: UserFields): Promise<User> {
  return (await authApi.put<User>(`/users/${id}`, fields)).data;
}

/**
 * Changes only whether an account can sign in, keeping the rest of its fields.
 *
 * @param user - Account to change; never `root`, which the API does not let anyone manage.
 * @param active - Whether the account can sign in.
 * @returns The updated account.
 */
export async function setUserActive(user: User, active: boolean): Promise<User> {
  if (!active) {
    return (await authApi.delete<User>(`/users/${user.id}`)).data;
  }
  return updateUser(user.id, { email: user.email, full_name: user.full_name, role: user.role as AssignableRole, is_active: true });
}
