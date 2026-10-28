"""Tests of the repair order endpoints, against a real SQLite schema."""

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


async def _create_engine(client: AsyncClient, make_token: Any, **overrides: Any) -> dict[str, Any]:
    """
    Register a client and an engine owned by it, through the API.

    Args:
        client: HTTP client bound to the application.
        make_token: Factory of signed tokens.
        overrides: Fields that replace the engine defaults.

    Returns:
        The created engine, as returned by the API.
    """
    client_payload: dict[str, Any] = {
        "name": "Minera Andina S.A.S.",
        "identification_type": "nit",
        "identification_number": str(uuid4().int)[:10],
        "email": "contact@minera-andina.com",
    }
    created_client: Response = await _authorized(client, make_token, "POST", "/api/v1/clients", json=client_payload)
    engine_payload: dict[str, Any] = {
        "serial_number": str(uuid4()),
        "manufacturer": "Caterpillar",
        "model": "3512C",
        "engine_type": "diesel",
        "power_rating": "2000 kW",
        "client_id": created_client.json()["id"],
    }
    engine_payload.update(overrides)
    created_engine: Response = await _authorized(client, make_token, "POST", "/api/v1/engines", json=engine_payload)
    return created_engine.json()


def _order_payload(engine_id: str, **overrides: Any) -> dict[str, Any]:
    """
    Build a valid repair order payload for the given engine.

    Args:
        engine_id: Identifier of the engine the order is for.
        overrides: Fields that replace the defaults.

    Returns:
        The payload.
    """
    payload: dict[str, Any] = {
        "engine_id": engine_id,
        "reported_issue": "Loses power above 1500 RPM",
    }
    payload.update(overrides)
    return payload


async def test_create_repair_order_returns_201(client: AsyncClient, make_token: Any) -> None:
    """A valid payload creates the order, derives its client from the engine and logs the initial history."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    payload: dict[str, Any] = _order_payload(engine["id"])
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=payload)
    assert response.status_code == 201
    body: dict[str, Any] = response.json()
    assert body["engine"]["id"] == engine["id"]
    assert body["client"]["id"] == engine["client_id"]
    assert body["status"] == "received"
    assert body["order_number"].startswith("RO-")
    assert len(body["history"]) == 1
    assert body["history"][0]["from_status"] is None
    assert body["history"][0]["to_status"] == "received"


async def test_create_repair_order_without_token_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """Creating a repair order requires authentication."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    response: Response = await client.post("/api/v1/repair-orders", json=_order_payload(engine["id"]))
    assert response.status_code == 401


async def test_create_repair_order_for_missing_engine_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """Registering an order for an engine that does not exist returns 404."""
    payload: dict[str, Any] = _order_payload(str(uuid4()))
    response: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Engine not found"


async def test_read_repair_order_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Fetching an identifier that does not exist returns 404."""
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/repair-orders/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_read_repair_order_returns_created_order(client: AsyncClient, make_token: Any) -> None:
    """A created order can be fetched by its identifier, with its history."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    create_payload: dict[str, Any] = _order_payload(engine["id"])
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=create_payload)
    order_id: str = created.json()["id"]
    response: Response = await _authorized(client, make_token, "GET", f"/api/v1/repair-orders/{order_id}")
    assert response.status_code == 200
    assert response.json()["id"] == order_id
    assert len(response.json()["history"]) == 1


async def test_list_repair_orders_paginates_by_cursor(client: AsyncClient, make_token: Any) -> None:
    """The listing respects `limit` and returns a cursor only when more rows may follow."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    for _ in range(3):
        await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=_order_payload(engine["id"]))

    first_page: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params={"limit": 2})
    assert first_page.status_code == 200
    first_body: dict[str, Any] = first_page.json()
    assert len(first_body["items"]) == 2
    assert first_body["next_cursor"] is not None

    params: dict[str, Any] = {"limit": 2, "cursor": first_body["next_cursor"]}
    second_page: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params=params)
    second_body: dict[str, Any] = second_page.json()
    assert len(second_body["items"]) == 1
    assert second_body["next_cursor"] is None

    first_ids: set[str] = {item["id"] for item in first_body["items"]}
    second_ids: set[str] = {item["id"] for item in second_body["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_list_repair_orders_filters_by_status_client_and_engine(client: AsyncClient, make_token: Any) -> None:
    """The `status`, `client_id` and `engine_id` filters narrow the listing."""
    engine_a: dict[str, Any] = await _create_engine(client, make_token)
    engine_b: dict[str, Any] = await _create_engine(client, make_token)
    create_url: str = "/api/v1/repair-orders"
    order_a: Response = await _authorized(client, make_token, "POST", create_url, json=_order_payload(engine_a["id"]))
    await _authorized(client, make_token, "POST", create_url, json=_order_payload(engine_b["id"]))

    list_url: str = create_url
    by_engine: Response = await _authorized(client, make_token, "GET", list_url, params={"engine_id": engine_a["id"]})
    assert len(by_engine.json()["items"]) == 1

    client_params: dict[str, str] = {"client_id": engine_b["client_id"]}
    by_client: Response = await _authorized(client, make_token, "GET", list_url, params=client_params)
    assert len(by_client.json()["items"]) == 1

    order_a_id: str = order_a.json()["id"]
    status_url: str = f"/api/v1/repair-orders/{order_a_id}/status"
    await _authorized(client, make_token, "PATCH", status_url, json={"status": "in_diagnosis"})

    by_status: Response = await _authorized(client, make_token, "GET", list_url, params={"status": "in_diagnosis"})
    assert len(by_status.json()["items"]) == 1
    assert by_status.json()["items"][0]["id"] == order_a_id


async def test_update_status_appends_history_entry(client: AsyncClient, make_token: Any) -> None:
    """Moving to a different status updates the order and appends one history entry."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    create_payload: dict[str, Any] = _order_payload(engine["id"])
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=create_payload)
    order_id: str = created.json()["id"]
    status_url: str = f"/api/v1/repair-orders/{order_id}/status"
    update_body: dict[str, Any] = {"status": "in_diagnosis", "note": "Checking the fuel injectors"}
    response: Response = await _authorized(client, make_token, "PATCH", status_url, json=update_body)
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["status"] == "in_diagnosis"
    assert len(body["history"]) == 2
    assert body["history"][1]["from_status"] == "received"
    assert body["history"][1]["to_status"] == "in_diagnosis"
    assert body["history"][1]["note"] == "Checking the fuel injectors"


async def test_update_status_to_same_status_is_rejected(client: AsyncClient, make_token: Any) -> None:
    """Setting the same status the order already has is a business rule violation."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    create_payload: dict[str, Any] = _order_payload(engine["id"])
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=create_payload)
    order_id: str = created.json()["id"]
    status_url: str = f"/api/v1/repair-orders/{order_id}/status"
    response: Response = await _authorized(client, make_token, "PATCH", status_url, json={"status": "received"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "business_rule_violation"


async def test_update_status_returns_404_when_missing(client: AsyncClient, make_token: Any) -> None:
    """Updating the status of an identifier that does not exist returns 404."""
    status_url: str = f"/api/v1/repair-orders/{uuid4()}/status"
    response: Response = await _authorized(client, make_token, "PATCH", status_url, json={"status": "in_diagnosis"})
    assert response.status_code == 404


async def test_update_status_to_delivered_sets_delivered_at(client: AsyncClient, make_token: Any) -> None:
    """Moving an order to `delivered` stamps `delivered_at` automatically."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    create_payload: dict[str, Any] = _order_payload(engine["id"])
    created: Response = await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=create_payload)
    order_id: str = created.json()["id"]
    assert created.json()["delivered_at"] is None
    status_url: str = f"/api/v1/repair-orders/{order_id}/status"
    response: Response = await _authorized(client, make_token, "PATCH", status_url, json={"status": "delivered"})
    assert response.status_code == 200
    assert response.json()["delivered_at"] is not None


async def test_summary_counts_every_status_in_process_order(client: AsyncClient, make_token: Any) -> None:
    """The summary lists all seven statuses in workshop order, with zero for the empty ones."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    created: list[Response] = [
        await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=_order_payload(engine["id"]))
        for _ in range(3)
    ]
    order_id: str = created[0].json()["id"]
    await _authorized(
        client, make_token, "PATCH", f"/api/v1/repair-orders/{order_id}/status", json={"status": "in_repair"}
    )

    response: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders/summary")

    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["total"] == 3
    assert body["by_status"] == [
        {"status": "received", "count": 2},
        {"status": "in_diagnosis", "count": 0},
        {"status": "awaiting_approval", "count": 0},
        {"status": "in_repair", "count": 1},
        {"status": "in_testing", "count": 0},
        {"status": "finished", "count": 0},
        {"status": "delivered", "count": 0},
    ]


async def test_summary_of_an_empty_workshop_is_all_zeros(client: AsyncClient, make_token: Any) -> None:
    """Without orders, the summary still lists every status."""
    response: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders/summary")
    assert response.json()["total"] == 0
    assert len(response.json()["by_status"]) == 7


async def test_summary_requires_read_permission(client: AsyncClient, make_token: Any) -> None:
    """A token without `repair_orders:read` cannot read the summary."""
    headers: dict[str, str] = {AUTH_HEADER_NAME: f"Bearer {make_token(permissions=[])}"}
    response: Response = await client.get("/api/v1/repair-orders/summary", headers=headers)
    assert response.status_code == 403


async def test_search_matches_number_issue_serial_and_client_ignoring_case(
    client: AsyncClient,
    make_token: Any,
) -> None:
    """The search finds orders by number, reported issue, engine serial number or client name."""
    owner: Response = await _authorized(
        client,
        make_token,
        "POST",
        "/api/v1/clients",
        json={
            "name": "Carbones del Cesar",
            "identification_type": "nit",
            "identification_number": str(uuid4().int)[:10],
            "email": "taller@carbones.com",
        },
    )
    engine: Response = await _authorized(
        client,
        make_token,
        "POST",
        "/api/v1/engines",
        json={
            "serial_number": "QSK60-777",
            "manufacturer": "Cummins",
            "model": "QSK60",
            "engine_type": "diesel",
            "power_rating": "2700 HP",
            "client_id": owner.json()["id"],
        },
    )
    target: Response = await _authorized(
        client,
        make_token,
        "POST",
        "/api/v1/repair-orders",
        json=_order_payload(engine.json()["id"], reported_issue="Turbo overheating at idle"),
    )
    other_engine: dict[str, Any] = await _create_engine(client, make_token)
    await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=_order_payload(other_engine["id"]))
    number: str = target.json()["order_number"]

    for text in [number.lower(), "TURBO", "qsk60-7", "carbones"]:
        params: dict[str, str] = {"search": text}
        response: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params=params)
        assert [item["order_number"] for item in response.json()["items"]] == [number], text


async def test_search_takes_wildcards_literally_and_combines_with_filters(client: AsyncClient, make_token: Any) -> None:
    """`%` and `_` in the search are plain characters, and the search narrows the other filters."""
    engine: dict[str, Any] = await _create_engine(client, make_token)
    await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=_order_payload(engine["id"]))

    wildcard: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params={"search": "%"})
    filtered: Response = await _authorized(
        client,
        make_token,
        "GET",
        "/api/v1/repair-orders",
        params={"search": "power", "status": "delivered"},
    )
    blank: Response = await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params={"search": "   "})

    assert wildcard.json()["items"] == []
    assert filtered.json()["items"] == []
    assert len(blank.json()["items"]) == 1


async def test_listing_runs_the_same_number_of_queries_for_any_page_size(
    app: FastAPI,
    client: AsyncClient,
    make_token: Any,
) -> None:
    """Engines and clients are loaded in batch, so a bigger page never adds queries (no N+1)."""
    for _ in range(8):
        engine: dict[str, Any] = await _create_engine(client, make_token)
        await _authorized(client, make_token, "POST", "/api/v1/repair-orders", json=_order_payload(engine["id"]))

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
        await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params={"limit": 1})
        small_page: int = len(statements)
        statements.clear()
        await _authorized(client, make_token, "GET", "/api/v1/repair-orders", params={"limit": 8, "search": "power"})
        big_page: int = len(statements)
    finally:
        event.remove(sync_engine, "before_cursor_execute", record)

    assert small_page == big_page
