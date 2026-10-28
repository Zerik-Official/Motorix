/**
 * @file Routes of `/api/v1/auth`; they are public, since they are how a token is obtained.
 */

import { Router } from "express";

import { AuthController } from "../controllers/auth.controller";
import type { AuthService } from "../services/auth.service";

/**
 * Builds the router of the authentication endpoints.
 *
 * @param service - Login and token issuance.
 * @returns The router.
 */
export function authRouter(service: AuthService): Router {
  const controller: AuthController = new AuthController(service);
  const router: Router = Router();
  router.post("/login", controller.login);
  return router;
}
