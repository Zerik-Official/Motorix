/**
 * @file HTTP handlers of the session endpoints; the refresh token only ever travels in an httpOnly cookie.
 */

import type { CookieOptions, Request, Response } from "express";

import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../core/security/refresh-token";
import { loginSchema, type LoginResponse } from "../schemas/auth.schemas";
import { toUserResponse } from "../schemas/user.schemas";
import type { AuthService, SessionResult } from "../services/auth.service";

/**
 * Handlers of `/api/v1/auth`.
 */
export class AuthController {
  /**
   * @param service - Sessions.
   * @param secureCookie - Whether the refresh cookie is only sent over HTTPS.
   */
  constructor(
    private readonly service: AuthService,
    private readonly secureCookie: boolean,
  ) {}

  /**
   * Attributes of the refresh cookie: unreadable by scripts, same-site only, limited to the session endpoints.
   *
   * @returns The cookie options, without an expiration.
   */
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookie, sameSite: "strict", path: REFRESH_COOKIE_PATH };
  }

  /**
   * Sets the refresh cookie and sends the access token with the account.
   *
   * @param response - Outgoing response, never cached.
   * @param result - Opened or renewed session.
   */
  private sendSession(response: Response, result: SessionResult): void {
    const body: LoginResponse = {
      access_token: result.token.accessToken,
      token_type: result.token.tokenType,
      expires_in: result.token.expiresIn,
      expires_at: result.token.expiresAt.toISOString(),
      session_expires_at: result.refreshToken.expiresAt.toISOString(),
      user: { ...toUserResponse(result.user), permissions: result.permissions },
    };
    response
      .cookie(REFRESH_COOKIE_NAME, result.refreshToken.token, {
        ...this.cookieOptions(),
        expires: result.refreshToken.expiresAt,
      })
      .set("Cache-Control", "no-store")
      .json(body);
  }

  /**
   * Reads the refresh token sent by the browser.
   *
   * @param request - Incoming request.
   * @returns The token, or undefined when the cookie is absent.
   */
  private presentedToken(request: Request): string | undefined {
    const value: unknown = request.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  /**
   * `POST /login`: exchanges email and password for an access token and opens a session.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response.
   */
  login = async (request: Request, response: Response): Promise<void> => {
    this.sendSession(response, await this.service.login(loginSchema.parse(request.body), request.ip));
  };

  /**
   * `POST /refresh`: renews the access token with the refresh cookie, rotating it.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response; the cookie is cleared when the session cannot continue.
   */
  refresh = async (request: Request, response: Response): Promise<void> => {
    try {
      this.sendSession(response, await this.service.refresh(this.presentedToken(request)));
    } catch (error: unknown) {
      response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
      throw error;
    }
  };

  /**
   * `POST /logout`: ends the session of the refresh cookie and clears it.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response, 204.
   */
  logout = async (request: Request, response: Response): Promise<void> => {
    await this.service.logout(this.presentedToken(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions()).status(204).end();
  };
}
