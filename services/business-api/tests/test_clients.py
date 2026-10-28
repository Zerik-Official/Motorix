"""Tests of the client CRUD endpoints, against a real SQLite schema."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

# Third-party
import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response

# Project imports
from app.db.base import Base

# Tests
from tests.conftest import SqliteDatabase

PRIVILEGED_HEADER_NAME = "Authorization"


@pytest.fixture
def database() -> SqliteDatabase:
    """
    Override the fake database of `conftest.py` with a real, queryable SQLite database.

    Returns:
        The SQLite database used by the application under test.
    """
    return SqliteDatabase()


@pytest.fixture(autouse=True)
async def _create_schema(app: FastAPI) -> AsyncIterator[None]:
    """
    Create every table before the test and dispose the database after it.

    Args:
        app: Application under test, built with the SQLite database.
    """
    database: SqliteDatabase = app.state.database
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    await database.dispose()


def _client_payload(**overrides: Any) -> dict[str, Any]:
    """
    Build a valid client payload, with unique identification by default.

    Args:
        overrides: Fields that replace the defaults.

    Returns:
        The payload.
    """
    payload: dict[str, Any] = {
        "name": "Minera Andina S.A.S.",
        "identification_type": "nit",
        "identification_number": str(uuid4().int)[:10],
        "email": "contact@minera-andina.com",
    }
    payload.update(overrides)
    return payload


async def _authorized(client: AsyncClient, make_token: Any, method: str, url: str, **kwargs: Any) -> Response:
    """
    Send a request with a valid bearer token.

    Args:
        client: HTTP client bound to the application.
        make_token: Factory of signed tokens.
        method: HTTP method.
        url: Request path.
        kwargs: Extra arguments forwarded to the client.

    Returns:
        The response.
    """
    headers: dict[str, str] = {PRIVILEGED_HEADER_NAME: f"Bearer {make_token()}"}
    return await client.request(method, url, headers=headers, **kwargs)


async def test_create_client_returns_201(client: AsyncClient, make_token: Any) -> None:
    """A valid payload creates the client and returns it with its generated fields."""
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    assert body["name"] == "Minera Andina S.A.S."
    assert body["is_active"] is True
    assert "id" in body and "created_at" in body


async def test_create_client_without_token_is_rejected(client: AsyncClient) -> None:
    """Creating a client requires authentication."""
    response: Response = await client.post("/api/v1/clients", json=_client_payload())
    assert response.status_code == 401


async def test_create_client_with_invalid_email_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """An invalid email fails validation before reaching the service."""
    payload: dict[str, Any] = _client_payload(email="not-an-email")
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=payload)
    assert response.status_code == 422


async def test_duplicate_identification_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """A second client with the same identification type and number is rejected as a conflict."""
    payload: dict[str, Any] = _client_payload()
    first: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=payload)
    assert first.status_code == 201
    duplicate: dict[str, Any] = {**payload, "email": "other@example.com"}
    second: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=duplicate)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


async def test_read_client_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Fetching an identifier that does not exist returns 404."""
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/clients/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_read_client_returns_created_client(client: AsyncClient, make_token: Any) -> None:
    """A created client can be fetched by its identifier."""
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    client_id: str = created.json()["id"]
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/clients/{client_id}")
    assert response.status_code == 200
    assert response.json()["id"] == client_id


async def test_list_clients_is_paginated(client: AsyncClient, make_token: Any) -> None:
    """The listing reports the total count and respects `limit` and `offset`."""
    for _ in range(3):
        await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    params: dict[str, int] = {"limit": 2, "offset": 1}
    response: Response = await _authorized(client, make_token, "GET", "/api/v1/clients", params=params)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["total"] == 3
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert len(body["items"]) == 2


async def test_list_clients_filters_by_search_and_active(client: AsyncClient, make_token: Any) -> None:
    """The search parameter matches the name and the active filter excludes other clients."""
    centro_payload: dict[str, Any] = _client_payload(name="Taller Centro")
    await _authorized(client, make_token, "POST", "/api/v1/clients", json=centro_payload)
    norte_payload: dict[str, Any] = _client_payload(name="Taller Norte")
    other: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=norte_payload)
    other_id: str = other.json()["id"]
    await _authorized(client, make_token, "DELETE", f"/api/v1/clients/{other_id}")

    search_url: str = "/api/v1/clients"
    by_search: Response = await _authorized(client, make_token, "GET", search_url, params={"search": "Centro"})
    assert by_search.json()["total"] == 1

    active_only: Response = await _authorized(client, make_token, "GET", search_url, params={"is_active": True})
    assert active_only.json()["total"] == 1

    inactive_only: Response = await _authorized(client, make_token, "GET", search_url, params={"is_active": False})
    assert inactive_only.json()["total"] == 1


async def test_update_client_replaces_fields(client: AsyncClient, make_token: Any) -> None:
    """A valid update replaces every editable field and keeps the same identifier."""
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    client_id: str = created.json()["id"]
    update_payload: dict[str, Any] = _client_payload(name="Updated Name")
    update_url: str = f"/api/v1/clients/{client_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=update_payload)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["id"] == client_id
    assert body["name"] == "Updated Name"


async def test_update_keeping_own_identification_is_allowed(client: AsyncClient, make_token: Any) -> None:
    """Resubmitting the same identification on an update is not treated as a duplicate."""
    payload: dict[str, Any] = _client_payload()
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=payload)
    client_id: str = created.json()["id"]
    update_url: str = f"/api/v1/clients/{client_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=payload)
    assert response.status_code == 200


async def test_update_to_anothers_identification_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """An update cannot steal the identification of a different client."""
    first: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    second_payload: dict[str, Any] = _client_payload()
    second: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=second_payload)
    second_id: str = second.json()["id"]
    stolen_fields: dict[str, Any] = {key: first.json()[key] for key in ("identification_type", "identification_number")}
    stolen_update: dict[str, Any] = {**second_payload, **stolen_fields}
    update_url: str = f"/api/v1/clients/{second_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=stolen_update)
    assert response.status_code == 409


async def test_update_client_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Updating an identifier that does not exist returns 404."""
    update_url: str = f"/api/v1/clients/{uuid4()}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=_client_payload())
    assert response.status_code == 404


async def test_deactivate_client_sets_is_active_false(client: AsyncClient, make_token: Any) -> None:
    """Deactivating a client does not delete its row, only flips `is_active`."""
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=_client_payload())
    client_id: str = created.json()["id"]
    response: Response = await _authorized(client, make_token, "DELETE", f"/api/v1/clients/{client_id}")
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    still_there: Response = await _authorized(client, make_token, "GET", f"/api/v1/clients/{client_id}")
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is False


async def test_deactivate_client_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Deactivating an identifier that does not exist returns 404."""
    response: Response = await _authorized(client, make_token, "DELETE", f"/api/v1/clients/{uuid4()}")
    assert response.status_code == 404
