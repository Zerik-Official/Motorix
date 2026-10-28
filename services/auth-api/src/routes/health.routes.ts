/**
 * @file Health check endpoint used by Docker, load balancers and CI.
 */

import { Router, type Request, type Response } from "express";

import { HealthService, type HealthReport, type Pingable } from "../services/health.service";

/**
 * Builds the router of `GET /health`, which answers 503 when a dependency is down.
 *
 * @param database - Database of the service.
 * @returns The router.
 */
export function healthRouter(database: Pingable): Router {
  const router: Router = Router();
  const service: HealthService = new HealthService(database);
  router.get("/health", async (_request: Request, response: Response): Promise<void> => {
    const report: HealthReport = await service.check();
    response.status(report.status === "ok" ? 200 : 503).json(report);
  });
  return router;
}
