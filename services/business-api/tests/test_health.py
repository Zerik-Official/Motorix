"""Tests of the health check and of the shared error format."""

# Standard library
from __future__ import annotations

# Third-party
from httpx import AsyncClient, Response

# Project imports
from tests.conftest import FakeDatabase


async def test_health_is_ok_when_database_answers(client: AsyncClient) -> None:
    """The health check reports OK when the database answers."""
    response: Response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_health_is_unavailable_when_database_is_down(client: AsyncClient, database: FakeDatabase) -> None:
    """The health check answers 503 when the database is down."""
    database.available = False
    response: Response = await client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}


async def test_unknown_route_uses_error_format(client: AsyncClient) -> None:
    """Framework errors share the error body of the service."""
    response: Response = await client.get("/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
