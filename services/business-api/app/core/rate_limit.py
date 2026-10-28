"""Per-client fixed window request limit of the `/api` routes, answered with the shared error body."""

# Standard library
from __future__ import annotations
import math
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from threading import Lock
from typing import Final

# Third-party
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Project imports
from app.core.errors import error_body
from app.core.logging import log

LIMITED_PREFIX: Final[str] = "/api"
SWEEP_THRESHOLD: Final[int] = 10_000
"""Number of tracked clients above which expired windows are dropped."""


@dataclass
class _Window:
    """Requests counted for one client in its current window."""

    started_at: float
    count: int


@dataclass(frozen=True)
class RateLimitDecision:
    """Outcome of counting one request."""

    allowed: bool
    remaining: int
    reset_after: int


class RateLimiter:
    """Counts requests per client in fixed windows kept in the memory of the process."""

    def __init__(self, limit: int, window_seconds: int, clock: Callable[[], float] = time.monotonic) -> None:
        """
        Create the limiter.

        Args:
            limit: Requests allowed per client in each window.
            window_seconds: Length of a window.
            clock: Source of the current time in seconds, replaceable in tests.
        """
        self.limit: int = limit
        self.window_seconds: int = window_seconds
        self._clock: Callable[[], float] = clock
        self._windows: dict[str, _Window] = {}
        self._lock: Lock = Lock()

    def hit(self, key: str) -> RateLimitDecision:
        """
        Count a request of a client.

        Args:
            key: Identifier of the client, its address.

        Returns:
            Whether the request is allowed, how many remain and when the window resets.
        """
        now: float = self._clock()
        with self._lock:
            if len(self._windows) > SWEEP_THRESHOLD:
                self._sweep(now)
            window: _Window | None = self._windows.get(key)
            if window is None or now - window.started_at >= self.window_seconds:
                window = _Window(started_at=now, count=0)
                self._windows[key] = window
            window.count += 1
            reset_after: int = max(1, math.ceil(window.started_at + self.window_seconds - now))
            return RateLimitDecision(
                allowed=window.count <= self.limit,
                remaining=max(0, self.limit - window.count),
                reset_after=reset_after,
            )

    def _sweep(self, now: float) -> None:
        """
        Drop the windows that already ended; the caller holds the lock.

        Args:
            now: Current time.
        """
        expired: list[str] = [
            key for key, window in self._windows.items() if now - window.started_at >= self.window_seconds
        ]
        for key in expired:
            del self._windows[key]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies a `RateLimiter` to every `/api` request; `/health` and the docs are never limited."""

    def __init__(self, app: ASGIApp, limiter: RateLimiter) -> None:
        """
        Create the middleware.

        Args:
            app: Application wrapped.
            limiter: Limiter shared by every request.
        """
        super().__init__(app)
        self._limiter: RateLimiter = limiter

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        """
        Count the request and answer `429` once the client is over its limit.

        Args:
            request: Incoming request.
            call_next: Next handler of the chain.

        Returns:
            The response, with the `RateLimit` and `RateLimit-Policy` headers on limited routes.
        """
        if not request.url.path.startswith(LIMITED_PREFIX):
            return await call_next(request)
        client: str = request.client.host if request.client is not None else "unknown"
        decision: RateLimitDecision = self._limiter.hit(client)
        headers: dict[str, str] = {
            "RateLimit-Policy": f'"default";q={self._limiter.limit};w={self._limiter.window_seconds}',
            "RateLimit": f'"default";r={decision.remaining};t={decision.reset_after}',
        }
        if not decision.allowed:
            log("WARNING", f"Rate limit reached by {client} on {request.method} {request.url.path}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=error_body("too_many_requests", "Too many requests, try again later"),
                headers={**headers, "Retry-After": str(decision.reset_after)},
            )
        response: Response = await call_next(request)
        response.headers.update(headers)
        return response
