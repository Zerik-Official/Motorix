"""Tests of the per-client request limit of the `/api` routes."""

# Standard library
from __future__ import annotations

# Third-party
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response

# Project imports
from app.core.config import Settings
from app.core.rate_limit import RateLimitDecision, RateLimiter
from app.main import create_app

# Tests
from tests.conftest import FakeDatabase, TokenFactory


class FakeClock:
    """Clock whose time the test moves by hand."""

    def __init__(self) -> None:
        """Start at zero."""
        self.now: float = 0.0

    def __call__(self) -> float:
        """
        Read the clock.

        Returns:
            The current time in seconds.
        """
        return self.now


def test_limiter_counts_per_client_and_resets_with_the_window() -> None:
    """Each client has its own counter, which starts over when its window ends."""
    clock: FakeClock = FakeClock()
    limiter: RateLimiter = RateLimiter(limit=2, window_seconds=60, clock=clock)

    assert limiter.hit("a").allowed
    assert limiter.hit("a").allowed
    blocked: RateLimitDecision = limiter.hit("a")
    assert not blocked.allowed
    assert blocked.remaining == 0
    assert blocked.reset_after == 60
    assert limiter.hit("b").allowed

    clock.now = 45.0
    assert limiter.hit("a").reset_after == 15

    clock.now = 60.0
    assert limiter.hit("a").allowed


async def test_api_answers_429_with_retry_after_but_never_limits_health(
    settings: Settings,
    make_token: TokenFactory,
) -> None:
    """Over the limit, `/api` answers 429 with the shared error body, while `/health` keeps answering."""
    app: FastAPI = create_app(settings.model_copy(update={"rate_limit_max": 2}), FakeDatabase())
    headers: dict[str, str] = {"Authorization": f"Bearer {make_token()}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first: Response = await client.get("/api/v1/me", headers=headers)
        await client.get("/api/v1/me", headers=headers)
        blocked: Response = await client.get("/api/v1/me", headers=headers)
        health: Response = await client.get("/health")

    assert first.status_code == 200
    assert first.headers["ratelimit-policy"] == f'"default";q=2;w={settings.rate_limit_window_seconds}'
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_requests"
    assert int(blocked.headers["retry-after"]) > 0
    assert health.status_code == 200
    assert "ratelimit" not in health.headers
