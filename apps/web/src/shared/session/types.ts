/**
 * Authorization role of an account, from the most to the least privileged.
 */
export type Role = "root" | "admin" | "user";

/**
 * Operation an account may be allowed to perform.
 */
export type Permission =
  | "clients:read"
  | "clients:write"
  | "engines:read"
  | "engines:write"
  | "repair_orders:read"
  | "repair_orders:write"
  | "users:manage"
  | "permissions:manage";

/**
 * Account of the signed in person, with the permissions its role holds.
 */
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  permissions: Permission[];
}

/**
 * Body returned by login and refresh; the refresh token travels in an httpOnly cookie, never here.
 */
export interface SessionResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  expires_at: string;
  session_expires_at: string;
  user: Profile;
}
