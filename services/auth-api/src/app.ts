/**
 * @file Application factory of auth-api.
 */

import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { accessLog } from "./core/access-log";
import type { Settings } from "./core/config";
import { errorHandler, notFoundHandler } from "./core/errors";
import type { JwtIssuer } from "./core/security/jwt-issuer";
import type { JwtVerifier } from "./core/security/jwt-verifier";
import type { PasswordHasher } from "./core/security/password-hasher";
import { authenticate } from "./middleware/authenticate";
import type { RolePermissionRepository } from "./repositories/role-permission.repository";
import type { UserRepository } from "./repositories/user.repository";
import { healthRouter } from "./routes/health.routes";
import { userRouter } from "./routes/user.routes";
import type { Pingable } from "./services/health.service";
import { PermissionService } from "./services/permission.service";
import { UserService } from "./services/user.service";

/**
 * Shared resources the application is built with.
 */
export interface AppContext {
  settings: Settings;
  database: Pingable;
  jwtIssuer: JwtIssuer;
  jwtVerifier: JwtVerifier;
  users: UserRepository;
  rolePermissions: RolePermissionRepository;
  hasher: PasswordHasher;
}

/**
 * Builds the application with its middleware, routers and error handlers.
 *
 * @param context - Settings and shared resources of the service.
 * @returns The configured application.
 */
export function createApp(context: AppContext): Express {
  const permissionService: PermissionService = new PermissionService(context.rolePermissions);
  const userService: UserService = new UserService(context.users, context.hasher, context.settings.maxPageSize);
  const authenticated: RequestHandler = authenticate(context.jwtVerifier, context.users, permissionService);

  const app: Express = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.locals.context = context;
  app.use(helmet());
  if (context.settings.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: context.settings.corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Authorization", "Content-Type"],
      }),
    );
  }
  app.use(express.json({ limit: "100kb" }));
  app.use(accessLog);
  app.use(healthRouter(context.database));
  app.use("/api/v1/users", userRouter(userService, authenticated));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
