/**
 * @file Application factory of auth-api.
 */

import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { accessLog } from "./core/access-log";
import type { Settings } from "./core/config";
import { errorHandler, notFoundHandler } from "./core/errors";
import type { CaptchaVerifier } from "./core/security/captcha";
import type { JwtIssuer } from "./core/security/jwt-issuer";
import type { JwtVerifier } from "./core/security/jwt-verifier";
import type { PasswordHasher } from "./core/security/password-hasher";
import { authenticate } from "./middleware/authenticate";
import { createRateLimiter } from "./middleware/rate-limit";
import type { RolePermissionRepository } from "./repositories/role-permission.repository";
import type { UserRepository } from "./repositories/user.repository";
import { authRouter } from "./routes/auth.routes";
import { healthRouter } from "./routes/health.routes";
import { roleRouter } from "./routes/role.routes";
import { userRouter } from "./routes/user.routes";
import { AuthService } from "./services/auth.service";
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
  captcha: CaptchaVerifier;
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
  const { settings } = context;
  const permissionService: PermissionService = new PermissionService(context.rolePermissions);
  const userService: UserService = new UserService(context.users, context.hasher, settings.maxPageSize);
  const authService: AuthService = new AuthService(
    context.users,
    context.hasher,
    permissionService,
    context.jwtIssuer,
    context.captcha,
  );
  const authenticated: RequestHandler = authenticate(context.jwtVerifier, context.users, permissionService);
  const apiLimiter: RequestHandler = createRateLimiter({
    windowSeconds: settings.rateLimit.windowSeconds,
    limit: settings.rateLimit.max,
  });
  const loginLimiter: RequestHandler = createRateLimiter({
    windowSeconds: settings.rateLimit.loginWindowSeconds,
    limit: settings.rateLimit.loginMax,
    skipSuccessfulRequests: true,
  });

  const app: Express = express();
  app.disable("x-powered-by");
  app.set("trust proxy", settings.trustProxy);
  app.locals.context = context;
  app.use(helmet());
  if (settings.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: settings.corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Authorization", "Content-Type"],
      }),
    );
  }
  app.use(express.json({ limit: "100kb" }));
  app.use(accessLog);
  app.use(healthRouter(context.database));
  app.use("/api", apiLimiter);
  app.use("/api/v1/auth", authRouter(authService, loginLimiter));
  app.use("/api/v1/users", userRouter(userService, authenticated));
  app.use("/api/v1/roles", roleRouter(permissionService, authenticated));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
