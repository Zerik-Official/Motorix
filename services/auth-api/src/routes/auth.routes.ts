/**
 * @file Routes of `/api/v1/auth`; they are public, since they are how a session is opened and kept.
 */

import { Router, type RequestHandler } from "express";

import { AuthController } from "../controllers/auth.controller";
import type { AuthService } from "../services/auth.service";

/**
 * Builds the router of the session endpoints.
 *
 * @param service - Sessions.
 * @param loginLimiter - Stricter limit applied to login attempts.
 * @param secureCookie - Whether the refresh cookie is only sent over HTTPS.
 * @returns The router.
 */
export function authRouter(service: AuthService, loginLimiter: RequestHandler, secureCookie: boolean): Router {
  const controller: AuthController = new AuthController(service, secureCookie);
  const router: Router = Router();
  router.post("/login", loginLimiter, controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", controller.logout);
  return router;
}
