"""Tests of the engine CRUD endpoints, against a real SQLite schema."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

# Third-party
import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response
from sqlalchemy import event

# Project imports
from app.db.base import Base

# Tests
from tests.conftest import SqliteDatabase

AUTH_HEADER_NAME = "Authorization"


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
    headers: dict[str, str] = {AUTH_HEADER_NAME: f"Bearer {make_token()}"}
    return await client.request(method, url, headers=headers, **kwargs)


async def _create_client(client: AsyncClient, make_token: Any, **overrides: Any) -> str:
    """
    Register a client through the API and return its identifier.

    Args:
        client: HTTP client bound to the application.
        make_token: Factory of signed tokens.
        overrides: Fields that replace the client defaults.

    Returns:
        The identifier of the created client.
    """
    payload: dict[str, Any] = {
        "name": "Minera Andina S.A.S.",
        "identification_type": "nit",
        "identification_number": str(uuid4().int)[:10],
        "email": "contact@minera-andina.com",
    }
    payload.update(overrides)
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=payload)
    return response.json()["id"]


def _engine_payload(client_id: str, **overrides: Any) -> dict[str, Any]:
    """
    Build a valid engine payload owned by the given client.

    Args:
        client_id: Identifier of the owning client.
        overrides: Fields that replace the defaults.

    Returns:
        The payload.
    """
    payload: dict[str, Any] = {
        "serial_number": str(uuid4()),
        "manufacturer": "Caterpillar",
        "model": "3512C",
        "engine_type": "diesel",
        "power_rating": "2000 kW",
        "client_id": client_id,
    }
    payload.update(overrides)
    return payload


async def test_create_engine_returns_201(client: AsyncClient, make_token: Any) -> None:
    """A valid payload creates the engine for an existing client."""
    client_id: str = await _create_client(client, make_token)
    payload: dict[str, Any] = _engine_payload(client_id)
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=payload)
    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    assert body["manufacturer"] == "Caterpillar"
    assert body["client_id"] == client_id
    assert body["is_active"] is True
    assert "id" in body and "registered_at" in body
    assert body["client"]["id"] == client_id
    assert body["client"]["name"] == "Minera Andina S.A.S."


async def test_create_engine_without_token_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """Creating an engine requires authentication."""
    client_id: str = await _create_client(client, make_token)
    response: Response = await client.post("/api/v1/engines", json=_engine_payload(client_id))
    assert response.status_code == 401


async def test_create_engine_for_missing_client_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """Registering an engine for a client that does not exist returns 404."""
    payload: dict[str, Any] = _engine_payload(str(uuid4()))
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Client not found"


async def test_duplicate_serial_number_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """A second engine with the same serial number is rejected as a conflict, even for another client."""
    client_id: str = await _create_client(client, make_token)
    payload: dict[str, Any] = _engine_payload(client_id)
    first: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=payload)
    assert first.status_code == 201

    other_client_id: str = await _create_client(client, make_token)
    duplicate: dict[str, Any] = _engine_payload(other_client_id, serial_number=payload["serial_number"])
    second: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=duplicate)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


async def test_read_engine_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Fetching an identifier that does not exist returns 404."""
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/engines/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_read_engine_returns_created_engine(client: AsyncClient, make_token: Any) -> None:
    """A created engine can be fetched by its identifier."""
    client_id: str = await _create_client(client, make_token)
    create_payload: dict[str, Any] = _engine_payload(client_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=create_payload)
    engine_id: str = created.json()["id"]
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/engines/{engine_id}")
    assert response.status_code == 200
    assert response.json()["id"] == engine_id


async def test_list_engines_is_paginated(client: AsyncClient, make_token: Any) -> None:
    """The listing reports the total count and respects `limit` and `offset`."""
    client_id: str = await _create_client(client, make_token)
    for _ in range(3):
        await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(client_id))
    params: dict[str, int] = {"limit": 2, "offset": 1}
    response: Response = await _authorized(client, make_token, "GET", "/api/v1/engines", params=params)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["total"] == 3
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert len(body["items"]) == 2


async def test_list_engines_filters_by_client_and_active(client: AsyncClient, make_token: Any) -> None:
    """The `client_id` filter and the active filter narrow the listing independently."""
    owner_id: str = await _create_client(client, make_token)
    other_owner_id: str = await _create_client(client, make_token)
    owned: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(owner_id))
    await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(other_owner_id))

    list_url: str = "/api/v1/engines"
    by_owner: Response = await _authorized(client, make_token, "GET", list_url, params={"client_id": owner_id})
    assert by_owner.json()["total"] == 1

    owned_id: str = owned.json()["id"]
    await _authorized(client, make_token, "DELETE", f"/api/v1/engines/{owned_id}")

    active_only: Response = await _authorized(client, make_token, "GET", list_url, params={"is_active": True})
    assert active_only.json()["total"] == 1

    inactive_only: Response = await _authorized(client, make_token, "GET", list_url, params={"is_active": False})
    assert inactive_only.json()["total"] == 1


async def test_list_engines_filters_by_search(client: AsyncClient, make_token: Any) -> None:
    """The search parameter matches the serial number, manufacturer or model."""
    client_id: str = await _create_client(client, make_token)
    await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(client_id, model="3512C"))
    await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(client_id, model="C175-20"))
    response: Response = await _authorized(client, make_token, "GET", "/api/v1/engines", params={"search": "3512"})
    assert response.json()["total"] == 1


async def test_update_engine_replaces_fields(client: AsyncClient, make_token: Any) -> None:
    """A valid update replaces every editable field and keeps the same identifier."""
    client_id: str = await _create_client(client, make_token)
    create_payload: dict[str, Any] = _engine_payload(client_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=create_payload)
    engine_id: str = created.json()["id"]
    update_payload: dict[str, Any] = _engine_payload(client_id, model="C175-20")
    update_url: str = f"/api/v1/engines/{engine_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=update_payload)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["id"] == engine_id
    assert body["model"] == "C175-20"


async def test_update_engine_for_missing_client_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """An update cannot reassign the engine to a client that does not exist."""
    client_id: str = await _create_client(client, make_token)
    create_payload: dict[str, Any] = _engine_payload(client_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=create_payload)
    engine_id: str = created.json()["id"]
    update_url: str = f"/api/v1/engines/{engine_id}"
    bad_update: dict[str, Any] = _engine_payload(str(uuid4()))
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=bad_update)
    assert response.status_code == 404


async def test_update_keeping_own_serial_number_is_allowed(client: AsyncClient, make_token: Any) -> None:
    """Resubmitting the same serial number on an update is not treated as a duplicate."""
    client_id: str = await _create_client(client, make_token)
    payload: dict[str, Any] = _engine_payload(client_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=payload)
    engine_id: str = created.json()["id"]
    update_url: str = f"/api/v1/engines/{engine_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=payload)
    assert response.status_code == 200


async def test_update_to_anothers_serial_number_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """An update cannot steal the serial number of a different engine."""
    client_id: str = await _create_client(client, make_token)
    first: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(client_id))
    second_payload: dict[str, Any] = _engine_payload(client_id)
    second: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=second_payload)
    second_id: str = second.json()["id"]
    stolen_update: dict[str, Any] = {**second_payload, "serial_number": first.json()["serial_number"]}
    update_url: str = f"/api/v1/engines/{second_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=stolen_update)
    assert response.status_code == 409


async def test_update_engine_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Updating an identifier that does not exist returns 404."""
    client_id: str = await _create_client(client, make_token)
    update_url: str = f"/api/v1/engines/{uuid4()}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=_engine_payload(client_id))
    assert response.status_code == 404


async def test_deactivate_engine_sets_is_active_false(client: AsyncClient, make_token: Any) -> None:
    """Deactivating an engine does not delete its row, only flips `is_active`."""
    client_id: str = await _create_client(client, make_token)
    create_payload: dict[str, Any] = _engine_payload(client_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=create_payload)
    engine_id: str = created.json()["id"]
    response: Response = await _authorized(client, make_token, "DELETE", f"/api/v1/engines/{engine_id}")
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    still_there: Response = await _authorized(client, make_token, "GET", f"/api/v1/engines/{engine_id}")
    assert still_there.status_code == 200
    assert still_there.json()["is_active"] is False


async def test_deactivate_engine_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Deactivating an identifier that does not exist returns 404."""
    response: Response = await _authorized(client, make_token, "DELETE", f"/api/v1/engines/{uuid4()}")
    assert response.status_code == 404


async def test_update_engine_returns_its_new_owner(client: AsyncClient, make_token: Any) -> None:
    """Reassigning an engine returns the new owner, not the one loaded before the change."""
    first_owner_id: str = await _create_client(client, make_token)
    second_owner_id: str = await _create_client(client, make_token, name="Carbones del Cesar S.A.")
    create_payload: dict[str, Any] = _engine_payload(first_owner_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=create_payload)
    engine_id: str = created.json()["id"]
    update_payload: dict[str, Any] = _engine_payload(second_owner_id, serial_number=created.json()["serial_number"])
    update_url: str = f"/api/v1/engines/{engine_id}"
    response: Response = await _authorized(client, make_token, "PUT", update_url, json=update_payload)
    assert response.status_code == 200
    assert response.json()["client"]["id"] == second_owner_id
    assert response.json()["client"]["name"] == "Carbones del Cesar S.A."


async def test_listing_runs_the_same_number_of_queries_for_any_page_size(
    app: FastAPI,
    client: AsyncClient,
    make_token: Any,
) -> None:
    """Owners are loaded in batch, so a bigger page of engines of different clients never adds queries (no N+1)."""
    for _ in range(8):
        owner_id: str = await _create_client(client, make_token)
        await _authorized(client, make_token, "POST", "/api/v1/engines", json=_engine_payload(owner_id))

    statements: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_args: Any) -> None:
        """
        Record every statement sent to the database.

        Args:
            _conn: Connection in use.
            _cursor: Cursor in use.
            statement: SQL sent.
            _args: Remaining event arguments.
        """
        statements.append(statement)

    sync_engine = app.state.database.engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", record)
    try:
        small: Response = await _authorized(client, make_token, "GET", "/api/v1/engines", params={"limit": 1})
        small_page: int = len(statements)
        statements.clear()
        big: Response = await _authorized(client, make_token, "GET", "/api/v1/engines", params={"limit": 8})
        big_page: int = len(statements)
    finally:
        event.remove(sync_engine, "before_cursor_execute", record)

    assert len(small.json()["items"]) == 1
    assert len({item["client"]["id"] for item in big.json()["items"]}) == 8
    assert small_page == big_page


async def test_update_can_reactivate_an_engine(client: AsyncClient, make_token: Any) -> None:
    """An update without `is_active` keeps a deactivated engine inactive, and `is_active: true` reactivates it."""
    owner_id: str = await _create_client(client, make_token)
    payload: dict[str, Any] = _engine_payload(owner_id)
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=payload)
    engine_url: str = f"/api/v1/engines/{created.json()['id']}"
    await _authorized(client, make_token, "DELETE", engine_url)

    kept: Response = await _authorized(client, make_token, "PUT", engine_url, json=payload)
    assert kept.json()["is_active"] is False

    reactivate: dict[str, Any] = {**payload, "is_active": True}
    reactivated: Response = await _authorized(client, make_token, "PUT", engine_url, json=reactivate)
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True
