/**
 * @file Application factory of auth-api.
 */

import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { accessLog } from "./core/access-log";
import type { Settings } from "./core/config";
import { errorHandler, notFoundHandler } from "./core/errors";
import type { JwtIssuer } from "./core/security/jwt-issuer";
import { healthRouter } from "./routes/health.routes";
import type { Pingable } from "./services/health.service";

/**
 * Shared resources the application is built with.
 */
export interface AppContext {
  settings: Settings;
  database: Pingable;
  jwtIssuer: JwtIssuer;
}

/**
 * Builds the application with its middleware, routers and error handlers.
 *
 * @param context - Settings and shared resources of the service.
 * @returns The configured application.
 */
export function createApp(context: AppContext): Express {
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
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
