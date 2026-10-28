/**
 * @file Application errors and the middleware that turns every failure into the same JSON error body.
 */

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { log } from "./logging";

/**
 * Body shared by every error response.
 */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

/**
 * Field that failed validation.
 */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Base error of the service, rendered as `{"error": {"code", "message", "details"}}`.
 */
export class AppError extends Error {
  readonly statusCode: number = 400;
  readonly code: string = "bad_request";
  readonly headers: Record<string, string> = {};

  /**
   * @param message - Human readable description.
   * @param details - Optional structured data about the failure.
   */
  constructor(
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The requested resource does not exist.
 */
export class NotFoundError extends AppError {
  override readonly statusCode: number = 404;
  override readonly code: string = "not_found";
}

/**
 * The request collides with existing data, such as a duplicated unique value.
 */
export class ConflictError extends AppError {
  override readonly statusCode: number = 409;
  override readonly code: string = "conflict";
}

/**
 * The request is well formed but breaks a business rule.
 */
export class BusinessRuleError extends AppError {
  override readonly statusCode: number = 422;
  override readonly code: string = "business_rule_violation";
}

/**
 * The request body, query or parameters do not match their schema.
 */
export class ValidationError extends AppError {
  override readonly statusCode: number = 422;
  override readonly code: string = "validation_error";
}

/**
 * The request has no valid credentials or access token.
 */
export class AuthenticationError extends AppError {
  override readonly statusCode: number = 401;
  override readonly code: string = "unauthorized";
  override readonly headers: Record<string, string> = { "WWW-Authenticate": "Bearer" };
}

/**
 * The authenticated user lacks the role or permission required by the operation.
 */
export class PermissionDeniedError extends AppError {
  override readonly statusCode: number = 403;
  override readonly code: string = "forbidden";
}

/**
 * A dependency of the service, such as the database, cannot be reached.
 */
export class ServiceUnavailableError extends AppError {
  override readonly statusCode: number = 503;
  override readonly code: string = "service_unavailable";
}

/**
 * Builds the JSON body shared by every error response.
 *
 * @param code - Machine readable error code.
 * @param message - Human readable description.
 * @param details - Optional structured data about the failure.
 * @returns The error body.
 */
export function errorBody(code: string, message: string, details: unknown = null): ErrorBody {
  return { error: { code, message, details } };
}

/**
 * Converts the issues of a zod error to the field list of a validation error.
 *
 * @param error - Error raised by a zod schema.
 * @returns One entry per invalid field.
 */
export function fieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}

/**
 * Tells whether an error was raised by the JSON body parser for a malformed body.
 *
 * @param error - Error to inspect.
 * @returns True for a body that is not valid JSON.
 */
function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError && (error as SyntaxError & { type?: string }).type === "entity.parse.failed";
}

/**
 * Answers every request that matched no route.
 *
 * @param request - Incoming request.
 * @param response - Outgoing response.
 */
export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json(errorBody("not_found", `Route ${request.method} ${request.path} not found`));
}

/**
 * Renders any error raised while handling a request; unexpected errors are logged and hidden.
 *
 * @param error - Raised error.
 * @param request - Incoming request.
 * @param response - Outgoing response.
 * @param _next - Next middleware, required by Express to detect an error handler.
 */
export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    response.status(error.statusCode).set(error.headers).json(errorBody(error.code, error.message, error.details));
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json(errorBody("validation_error", "The request is not valid", fieldErrors(error)));
    return;
  }
  if (isMalformedJson(error)) {
    response.status(400).json(errorBody("invalid_json", "The request body is not valid JSON"));
    return;
  }
  log("ERROR", `Unhandled error on ${request.method} ${request.path}: ${String(error)}`);
  response.status(500).json(errorBody("internal_error", "An unexpected error occurred"));
}
