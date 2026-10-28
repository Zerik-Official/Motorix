/**
 * @file Routes of `/api/v1/users`; every one requires a valid access token.
 */

import { Router, type RequestHandler } from "express";

import { UserController } from "../controllers/user.controller";
import { requirePermission } from "../middleware/authenticate";
import type { UserService } from "../services/user.service";

/**
 * Builds the router of the user endpoints.
 *
 * @param service - Account management.
 * @param authenticated - Middleware that verifies the token and loads the caller.
 * @returns The router.
 */
export function userRouter(service: UserService, authenticated: RequestHandler): Router {
  const controller: UserController = new UserController(service);
  const manage: RequestHandler = requirePermission("users:manage");
  const router: Router = Router();
  router.use(authenticated);
  router.get("/me", controller.getOwn);
  router.put("/me/password", controller.changeOwnPassword);
  router.get("/", manage, controller.list);
  router.post("/", manage, controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", manage, controller.update);
  router.delete("/:id", manage, controller.deactivate);
  return router;
}
