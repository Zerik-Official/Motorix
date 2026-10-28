"""Application errors and the handlers that turn every failure into the same JSON error body."""

# Standard library
from __future__ import annotations
from typing import Any

# Third-party
from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Project imports
from app.core.logging import log


class AppError(Exception):
    """Base error of the service, rendered as `{"error": {"code", "message", "details"}}`."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"
    headers: dict[str, str] | None = None

    def __init__(self, message: str, details: Any = None) -> None:
        """
        Create the error.

        Args:
            message: Human readable description.
            details: Optional structured data about the failure.
        """
        super().__init__(message)
        self.message: str = message
        self.details: Any = details


class NotFoundError(AppError):
    """The requested resource does not exist."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    """The request collides with existing data, such as a duplicated unique value."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class BusinessRuleError(AppError):
    """The request is well formed but breaks a business rule."""

    status_code = 422
    code = "business_rule_violation"


class AuthenticationError(AppError):
    """The request has no valid access token."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"
    headers = {"WWW-Authenticate": "Bearer"}


class PermissionDeniedError(AppError):
    """The authenticated user lacks the role required by the operation."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class ServiceUnavailableError(AppError):
    """A dependency of the service, such as the database, cannot be reached."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    """
    Build the JSON body shared by every error response.

    Args:
        code: Machine readable error code.
        message: Human readable description.
        details: Optional structured data about the failure.

    Returns:
        The error body.
    """
    return {"error": {"code": code, "message": message, "details": details}}


async def _handle_app_error(_: Request, exc: Exception) -> JSONResponse:
    """
    Render an application error.

    Args:
        _: Incoming request.
        exc: Raised `AppError`.

    Returns:
        The error response with the status of the error.
    """
    error: AppError = exc if isinstance(exc, AppError) else AppError(str(exc))
    return JSONResponse(
        status_code=error.status_code,
        content=jsonable_encoder(error_body(error.code, error.message, error.details)),
        headers=error.headers,
    )


async def _handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    """
    Render a request validation error.

    Args:
        _: Incoming request.
        exc: Raised `RequestValidationError`.

    Returns:
        A 422 response listing the invalid fields.
    """
    errors: list[Any] = list(exc.errors()) if isinstance(exc, RequestValidationError) else []
    details: list[dict[str, Any]] = [
        {"field": ".".join(str(part) for part in error.get("loc", ())), "message": error.get("msg", "")}
        for error in errors
    ]
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(error_body("validation_error", "The request is not valid", details)),
    )


async def _handle_http_error(_: Request, exc: Exception) -> JSONResponse:
    """
    Render an HTTP error raised by the framework, such as an unknown route.

    Args:
        _: Incoming request.
        exc: Raised `HTTPException`.

    Returns:
        The error response with the status of the exception.
    """
    status_code: int = exc.status_code if isinstance(exc, StarletteHTTPException) else 500
    detail: str = str(exc.detail) if isinstance(exc, StarletteHTTPException) else "Error"
    headers: dict[str, str] | None = exc.headers if isinstance(exc, StarletteHTTPException) else None
    code: str = "not_found" if status_code == status.HTTP_404_NOT_FOUND else "http_error"
    return JSONResponse(status_code=status_code, content=error_body(code, detail), headers=headers)


async def _handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """
    Log an unexpected failure and hide its internals from the client.

    Args:
        request: Incoming request.
        exc: Unhandled exception.

    Returns:
        A generic 500 response.
    """
    log("ERROR", f"Unhandled error on {request.method} {request.url.path}: {exc!r}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_body("internal_error", "An unexpected error occurred"),
    )


def register_error_handlers(app: FastAPI) -> None:
    """
    Attach every error handler to the application.

    Args:
        app: Application to configure.
    """
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
