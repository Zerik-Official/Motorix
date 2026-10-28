/**
 * @file OpenAPI 3.1 document of auth-api, built from the same zod schemas that validate the requests.
 */

import { OpenAPIRegistry, OpenApiGeneratorV31, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { PERMISSIONS } from "../core/security/permissions";
import { ROLES } from "../core/security/roles";
import { loginSchema } from "../schemas/auth.schemas";
import { rolePermissionParamsSchema } from "../schemas/role.schemas";
import {
  passwordChangeSchema,
  userCreateSchema,
  userListQuerySchema,
  userUpdateSchema,
} from "../schemas/user.schemas";

/**
 * Document produced by the generator.
 */
export type OpenApiDocument = ReturnType<OpenApiGeneratorV31["generateDocument"]>;

const permission = z.enum(PERMISSIONS).meta({ id: "Permission" });
const role = z.enum(ROLES).meta({ id: "Role" });

const errorResponse = z
  .object({
    error: z.object({
      code: z.string().meta({ example: "forbidden" }),
      message: z.string().meta({ example: "This operation requires 'users:manage'" }),
      details: z.unknown().nullable(),
    }),
  })
  .meta({ id: "ErrorResponse" });

const userResponse = z
  .object({
    id: z.uuid(),
    email: z.email(),
    full_name: z.string(),
    role,
    is_active: z.boolean(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .meta({ id: "User" });

const profileResponse = userResponse
  .extend({ permissions: z.array(permission) })
  .meta({ id: "Profile", description: "The caller's account with the permissions its role holds right now." });

const userPage = z
  .object({
    items: z.array(userResponse),
    total: z.int().min(0),
    limit: z.int().min(1),
    offset: z.int().min(0),
  })
  .meta({ id: "UserPage" });

const sessionResponse = z
  .object({
    access_token: z.string().meta({ description: "RS256 JWT with sub, role, permissions, iss, aud, iat and exp." }),
    token_type: z.literal("Bearer"),
    expires_in: z.int().meta({ example: 3600 }),
    expires_at: z.iso.datetime(),
    session_expires_at: z.iso.datetime().meta({ description: "Absolute end of the session, after which login is required." }),
    user: profileResponse,
  })
  .meta({
    id: "SessionResponse",
    description: "The refresh token is never in the body: it is set as an httpOnly cookie limited to /api/v1/auth.",
  });

const roleResponse = z
  .object({
    role,
    permissions: z.array(permission),
    editable: z.boolean().meta({ description: "Whether the caller may grant or revoke permissions of this role." }),
  })
  .meta({ id: "RolePermissions" });

const roleListResponse = z
  .object({ catalog: z.array(permission), roles: z.array(roleResponse) })
  .meta({ id: "RoleList" });

const healthResponse = z
  .object({ status: z.enum(["ok", "unavailable"]), database: z.enum(["ok", "unavailable"]) })
  .meta({ id: "Health" });

const userIdParams = z.object({ id: z.uuid() });

/**
 * Builds the JSON response entry of one status code.
 *
 * @param description - What the response means.
 * @param schema - Body of the response.
 * @returns The response definition.
 */
function json(description: string, schema: z.ZodType): { description: string; content: { "application/json": { schema: z.ZodType } } } {
  return { description, content: { "application/json": { schema } } };
}

/**
 * Builds the JSON request body entry.
 *
 * @param schema - Body of the request.
 * @returns The request body definition.
 */
function body(schema: z.ZodType): { body: { content: { "application/json": { schema: z.ZodType } } } } {
  return { body: { content: { "application/json": { schema } } } };
}

const unauthorized = json("Missing, invalid or expired token, or inactive account", errorResponse);
const forbidden = json("The caller lacks the permission or the role hierarchy forbids the change", errorResponse);
const invalid = json("The request does not match its schema", errorResponse);
const tooMany = json("Too many requests from this client; see Retry-After", errorResponse);
const secured: RouteConfig["security"] = [{ bearerAuth: [] }];

/**
 * Registers every endpoint of the service.
 *
 * @param registry - Registry the paths are added to.
 */
function registerPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/health",
    tags: ["health"],
    summary: "Check the service and its database",
    responses: { 200: json("The service can serve requests", healthResponse), 503: json("The database is down", healthResponse) },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/login",
    tags: ["auth"],
    summary: "Exchange email and password for an access token",
    description:
      "Verifies the Turnstile token first when it is enabled. Unknown email, wrong password and inactive " +
      "account all answer the same 401. Only failed attempts count towards the login rate limit.",
    request: body(loginSchema),
    responses: {
      200: json("Signed access token and the account; sets the refresh cookie", sessionResponse),
      400: json("Missing or rejected human verification", errorResponse),
      401: json("Invalid email or password", errorResponse),
      422: invalid,
      429: tooMany,
      503: json("The human verification service is unavailable", errorResponse),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/refresh",
    tags: ["auth"],
    summary: "Renew the access token with the refresh cookie",
    description:
      "Reads the `motorix_refresh` cookie, rotates it and returns a new access token with the permissions the " +
      "role holds now. The session keeps its original end. Reusing a token that was already rotated ends the " +
      "whole session. Any failure clears the cookie.",
    security: [{ refreshCookie: [] }],
    responses: {
      200: json("New access token and the account; sets the rotated refresh cookie", sessionResponse),
      401: json("The session has ended", errorResponse),
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/logout",
    tags: ["auth"],
    summary: "End the session of the refresh cookie",
    description: "Revokes the session and clears the cookie. Answers 204 even without a session.",
    security: [{ refreshCookie: [] }],
    responses: { 204: { description: "Session ended" }, 429: tooMany },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/users/me",
    tags: ["users"],
    summary: "Return the caller's account and current permissions",
    security: secured,
    responses: { 200: json("The caller's account", profileResponse), 401: unauthorized, 429: tooMany },
  });

  registry.registerPath({
    method: "put",
    path: "/api/v1/users/me/password",
    tags: ["users"],
    summary: "Change the caller's own password",
    security: secured,
    request: body(passwordChangeSchema),
    responses: {
      204: { description: "Password changed" },
      401: unauthorized,
      422: json("Invalid body, wrong current password or same password", errorResponse),
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/users",
    tags: ["users"],
    summary: "List accounts with offset pagination, search and filters",
    description: "Requires `users:manage`.",
    security: secured,
    request: { query: userListQuerySchema },
    responses: { 200: json("One page of accounts", userPage), 401: unauthorized, 403: forbidden, 422: invalid, 429: tooMany },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/users",
    tags: ["users"],
    summary: "Register an account with a role below the caller's",
    description: "Requires `users:manage`. `root` can register `admin` and `user`; `admin` only `user`.",
    security: secured,
    request: body(userCreateSchema),
    responses: {
      201: json("The created account", userResponse),
      401: unauthorized,
      403: forbidden,
      409: json("The email is already used", errorResponse),
      422: invalid,
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/users/{id}",
    tags: ["users"],
    summary: "Fetch one account",
    description: "Anyone can read their own account; reading others requires `users:manage`.",
    security: secured,
    request: { params: userIdParams },
    responses: {
      200: json("The account", userResponse),
      401: unauthorized,
      403: forbidden,
      404: json("The account does not exist", errorResponse),
      422: invalid,
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/v1/users/{id}",
    tags: ["users"],
    summary: "Replace the editable fields of an account",
    description:
      "Requires `users:manage` and outranking both the current and the new role of the account. " +
      "Sending `password` resets it.",
    security: secured,
    request: { params: userIdParams, ...body(userUpdateSchema) },
    responses: {
      200: json("The updated account", userResponse),
      401: unauthorized,
      403: forbidden,
      404: json("The account does not exist", errorResponse),
      409: json("The email is already used", errorResponse),
      422: invalid,
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/users/{id}",
    tags: ["users"],
    summary: "Deactivate an account without deleting it",
    description: "Requires `users:manage` and outranking the account. It can no longer log in or call the API.",
    security: secured,
    request: { params: userIdParams },
    responses: {
      200: json("The deactivated account", userResponse),
      401: unauthorized,
      403: forbidden,
      404: json("The account does not exist", errorResponse),
      422: invalid,
      429: tooMany,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/roles",
    tags: ["roles"],
    summary: "List the permission catalog and every role with its permissions",
    description: "Requires `permissions:manage`.",
    security: secured,
    responses: { 200: json("Catalog and roles", roleListResponse), 401: unauthorized, 403: forbidden, 429: tooMany },
  });

  for (const [method, summary] of [
    ["put", "Grant a permission to a role"],
    ["delete", "Revoke a permission from a role"],
  ] as const) {
    registry.registerPath({
      method,
      path: "/api/v1/roles/{role}/permissions/{permission}",
      tags: ["roles"],
      summary,
      description:
        "Requires `permissions:manage`. Only roles strictly below the caller's can change, never `root`, " +
        "and only with permissions the caller holds. Repeating the call changes nothing.",
      security: secured,
      request: { params: rolePermissionParamsSchema },
      responses: {
        200: json("The role with its updated permissions", roleResponse),
        401: unauthorized,
        403: forbidden,
        422: invalid,
        429: tooMany,
      },
    });
  }
}

/**
 * Builds the OpenAPI document of the service.
 *
 * @returns The document, ready to be served as JSON.
 */
export function buildOpenApiDocument(): OpenApiDocument {
  const registry: OpenAPIRegistry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Access token returned by `POST /api/v1/auth/login` or `POST /api/v1/auth/refresh`.",
  });
  registry.registerComponent("securitySchemes", "refreshCookie", {
    type: "apiKey",
    in: "cookie",
    name: "motorix_refresh",
    description: "httpOnly refresh cookie set by the login; scripts cannot read it.",
  });
  registerPaths(registry);
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Motorix auth API",
      version: "0.1.0",
      description: "Users, roles, permissions, login and RS256 token issuance of the Motorix workshop.",
    },
    tags: [
      { name: "auth", description: "Login, session renewal and logout" },
      { name: "users", description: "Accounts and the role hierarchy" },
      { name: "roles", description: "Permissions granted to each role" },
      { name: "health", description: "Service status" },
    ],
  });
}
