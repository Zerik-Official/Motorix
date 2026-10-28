/**
 * @file HTTP handlers of the authentication endpoints.
 */

import type { Request, Response } from "express";

import { loginSchema, type LoginResponse } from "../schemas/auth.schemas";
import { toUserResponse } from "../schemas/user.schemas";
import type { AuthService, LoginResult } from "../services/auth.service";

/**
 * Handlers of `/api/v1/auth`.
 */
export class AuthController {
  /**
   * @param service - Login and token issuance.
   */
  constructor(private readonly service: AuthService) {}

  /**
   * `POST /login`: exchanges email and password for an access token.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response, never cached.
   */
  login = async (request: Request, response: Response): Promise<void> => {
    const result: LoginResult = await this.service.login(loginSchema.parse(request.body), request.ip);
    const body: LoginResponse = {
      access_token: result.token.accessToken,
      token_type: result.token.tokenType,
      expires_in: result.token.expiresIn,
      expires_at: result.token.expiresAt.toISOString(),
      user: { ...toUserResponse(result.user), permissions: result.permissions },
    };
    response.set("Cache-Control", "no-store").json(body);
  };
}
