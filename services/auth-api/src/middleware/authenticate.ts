/**
 * @file Authentication and permission checks of the protected endpoints.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";

import { AuthenticationError, PermissionDeniedError } from "../core/errors";
import type { Caller } from "../core/security/caller";
import type { JwtVerifier } from "../core/security/jwt-verifier";
import type { Permission } from "../core/security/permissions";
import type { UserRecord, UserRepository } from "../repositories/user.repository";
import type { PermissionService } from "../services/permission.service";

/**
 * Extracts the token of a `Bearer` authorization header.
 *
 * @param header - Value of the `Authorization` header.
 * @returns The token.
 * @throws AuthenticationError When the header is missing or uses another scheme.
 */
function bearerToken(header: string | undefined): string {
  const [scheme, token] = (header ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AuthenticationError("A bearer access token is required");
  }
  return token;
}

/**
 * Builds the middleware that verifies the access token and loads the caller.
 *
 * The account is read from the database on every request, so a deactivated account loses access
 * at once and its role and permissions are always the current ones, not those frozen in the token.
 *
 * @param verifier - Access token verifier.
 * @param users - Account storage.
 * @param permissions - Permission resolution per role.
 * @returns The middleware, which stores the caller in `response.locals.caller`.
 */
export function authenticate(verifier: JwtVerifier, users: UserRepository, permissions: PermissionService): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const userId: string = await verifier.verify(bearerToken(request.headers.authorization));
    const user: UserRecord | null = await users.findById(userId);
    if (user === null || !user.isActive) {
      throw new AuthenticationError("The account does not exist or is inactive");
    }
    const caller: Caller = { id: user.id, role: user.role, permissions: await permissions.resolve(user.role) };
    response.locals.caller = caller;
    next();
  };
}

/**
 * Reads the caller stored by `authenticate`.
 *
 * @param response - Outgoing response of an authenticated request.
 * @returns The caller.
 * @throws AuthenticationError When the request was not authenticated.
 */
export function currentCaller(response: Response): Caller {
  const caller: Caller | undefined = response.locals.caller;
  if (caller === undefined) {
    throw new AuthenticationError("Authentication is required");
  }
  return caller;
}

/**
 * Builds the middleware that requires a permission from the caller.
 *
 * @param permission - Permission the endpoint requires.
 * @returns The middleware.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return (_request: Request, response: Response, next: NextFunction): void => {
    if (!currentCaller(response).permissions.includes(permission)) {
      throw new PermissionDeniedError(`This operation requires '${permission}'`, { permission });
    }
    next();
  };
}
