/**
 * @file Access log of every request, written through the logger of the service.
 */

import type { NextFunction, Request, Response } from "express";

import { log } from "./logging";

/**
 * Logs method, path, status and duration once each response is sent.
 *
 * Successful health checks are left out: they say nothing and bury everything else.
 *
 * @param request - Incoming request.
 * @param response - Outgoing response.
 * @param next - Next middleware.
 */
export function accessLog(request: Request, response: Response, next: NextFunction): void {
  const startedAt: number = performance.now();
  response.on("finish", () => {
    if (request.path === "/health" && response.statusCode === 200) {
      return;
    }
    const elapsed: string = (performance.now() - startedAt).toFixed(1);
    const level: string = response.statusCode >= 500 ? "ERROR" : response.statusCode >= 400 ? "WARNING" : "INFO";
    log(level, `${request.method} ${request.originalUrl} ${response.statusCode} ${elapsed}ms`, 2);
  });
  next();
}
