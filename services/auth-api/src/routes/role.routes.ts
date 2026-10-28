/**
 * @file Routes of `/api/v1/roles`; every one requires a valid access token and `permissions:manage`.
 */

import { Router, type RequestHandler } from "express";

import { RoleController } from "../controllers/role.controller";
import { requirePermission } from "../middleware/authenticate";
import type { PermissionService } from "../services/permission.service";

/**
 * Builds the router of the role permission endpoints.
 *
 * @param service - Permission resolution and changes.
 * @param authenticated - Middleware that verifies the token and loads the caller.
 * @returns The router.
 */
export function roleRouter(service: PermissionService, authenticated: RequestHandler): Router {
  const controller: RoleController = new RoleController(service);
  const router: Router = Router();
  router.use(authenticated, requirePermission("permissions:manage"));
  router.get("/", controller.list);
  router.put("/:role/permissions/:permission", controller.grant);
  router.delete("/:role/permissions/:permission", controller.revoke);
  return router;
}
