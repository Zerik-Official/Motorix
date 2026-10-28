/**
 * @file HTTP handlers of the role permission endpoints.
 */

import type { Request, Response } from "express";

import { PERMISSIONS } from "../core/security/permissions";
import { currentCaller } from "../middleware/authenticate";
import { rolePermissionParamsSchema, type RoleListResponse, type RoleResponse } from "../schemas/role.schemas";
import type { PermissionService } from "../services/permission.service";

/**
 * Handlers of `/api/v1/roles`.
 */
export class RoleController {
  /**
   * @param service - Permission resolution and changes.
   */
  constructor(private readonly service: PermissionService) {}

  /**
   * `GET /`: the permission catalog and every role with its permissions.
   *
   * @param _request - Incoming request.
   * @param response - Outgoing response.
   */
  list = async (_request: Request, response: Response): Promise<void> => {
    const body: RoleListResponse = {
      catalog: [...PERMISSIONS],
      roles: await this.service.listRoles(currentCaller(response)),
    };
    response.json(body);
  };

  /**
   * `PUT /:role/permissions/:permission`: grants a permission to a role.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response with the updated role.
   */
  grant = async (request: Request, response: Response): Promise<void> => {
    const { role, permission } = rolePermissionParamsSchema.parse(request.params);
    const body: RoleResponse = await this.service.grant(currentCaller(response), role, permission);
    response.json(body);
  };

  /**
   * `DELETE /:role/permissions/:permission`: revokes a permission from a role.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response with the updated role.
   */
  revoke = async (request: Request, response: Response): Promise<void> => {
    const { role, permission } = rolePermissionParamsSchema.parse(request.params);
    const body: RoleResponse = await this.service.revoke(currentCaller(response), role, permission);
    response.json(body);
  };
}
