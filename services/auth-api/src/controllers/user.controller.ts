/**
 * @file HTTP handlers of the user endpoints: validate the input, call the service, shape the output.
 */

import type { Request, Response } from "express";

import type { Caller } from "../core/security/caller";
import { currentCaller } from "../middleware/authenticate";
import {
  passwordChangeSchema,
  toUserResponse,
  userCreateSchema,
  userIdSchema,
  userListQuerySchema,
  userUpdateSchema,
  type Page,
  type ProfileResponse,
  type UserResponse,
} from "../schemas/user.schemas";
import type { UserService } from "../services/user.service";

/**
 * Handlers of `/api/v1/users`.
 */
export class UserController {
  /**
   * @param service - Account management.
   */
  constructor(private readonly service: UserService) {}

  /**
   * `GET /me`: the caller's own account and current permissions.
   *
   * @param _request - Incoming request.
   * @param response - Outgoing response.
   */
  getOwn = async (_request: Request, response: Response): Promise<void> => {
    const caller: Caller = currentCaller(response);
    const body: ProfileResponse = {
      ...toUserResponse(await this.service.getOwn(caller)),
      permissions: [...caller.permissions],
    };
    response.json(body);
  };

  /**
   * `PUT /me/password`: changes the caller's own password.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response, 204 on success.
   */
  changeOwnPassword = async (request: Request, response: Response): Promise<void> => {
    await this.service.changeOwnPassword(currentCaller(response), passwordChangeSchema.parse(request.body));
    response.status(204).end();
  };

  /**
   * `GET /`: lists accounts with pagination, search and filters.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response.
   */
  list = async (request: Request, response: Response): Promise<void> => {
    const page = await this.service.list(userListQuerySchema.parse(request.query));
    const body: Page<UserResponse> = {
      items: page.items.map(toUserResponse),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
    response.json(body);
  };

  /**
   * `POST /`: registers an account.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response, 201 with the account.
   */
  create = async (request: Request, response: Response): Promise<void> => {
    const user = await this.service.create(currentCaller(response), userCreateSchema.parse(request.body));
    response.status(201).json(toUserResponse(user));
  };

  /**
   * `GET /:id`: one account.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response.
   */
  get = async (request: Request, response: Response): Promise<void> => {
    const user = await this.service.get(currentCaller(response), userIdSchema.parse(request.params.id));
    response.json(toUserResponse(user));
  };

  /**
   * `PUT /:id`: replaces the editable fields of an account.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response.
   */
  update = async (request: Request, response: Response): Promise<void> => {
    const user = await this.service.update(
      currentCaller(response),
      userIdSchema.parse(request.params.id),
      userUpdateSchema.parse(request.body),
    );
    response.json(toUserResponse(user));
  };

  /**
   * `DELETE /:id`: deactivates an account.
   *
   * @param request - Incoming request.
   * @param response - Outgoing response.
   */
  deactivate = async (request: Request, response: Response): Promise<void> => {
    const user = await this.service.deactivate(currentCaller(response), userIdSchema.parse(request.params.id));
    response.json(toUserResponse(user));
  };
}
