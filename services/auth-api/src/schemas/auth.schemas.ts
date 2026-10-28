/**
 * @file Request schema and response shape of the authentication endpoints.
 */

import { z } from "zod";

import type { ProfileResponse } from "./user.schemas";

/**
 * Body of `POST /api/v1/auth/login`.
 */
export const loginSchema = z.strictObject({
  email: z.email().max(255).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

/**
 * Validated body of `POST /api/v1/auth/login`.
 */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Body returned after a successful login.
 */
export interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  expires_at: string;
  user: ProfileResponse;
}
