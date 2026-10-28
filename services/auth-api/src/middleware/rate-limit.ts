/**
 * @file Per-client request limits, answered with the shared error body.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";

import { TooManyRequestsError } from "../core/errors";
import { log } from "../core/logging";

/**
 * Options of a limiter.
 */
export interface RateLimitOptions {
  windowSeconds: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
}

/**
 * Builds a limiter keyed by client address, kept in the memory of the process.
 *
 * It sends the `RateLimit` and `RateLimit-Policy` headers and, once the limit is reached, a `429`
 * with `Retry-After`.
 *
 * @param options - Window, number of requests allowed in it, and whether successful requests count.
 * @returns The middleware.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowSeconds * 1000,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    handler: (request: Request, _response: Response, next: NextFunction): void => {
      log("WARNING", `Rate limit reached by ${request.ip} on ${request.method} ${request.originalUrl}`);
      next(new TooManyRequestsError("Too many requests, try again later"));
    },
  });
}
