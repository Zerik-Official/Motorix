"""Tests of the permission checks that every business endpoint applies to the `permissions` claim."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator
from uuid import uuid4

# Third-party
import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response

# Project imports
from app.db.base import Base

# Tests
from tests.conftest import SqliteDatabase, TokenFactory

OPERATOR_PERMISSIONS: list[str] = ["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"]
"""Default permissions of the `user` role in auth-api."""

CLIENT_PAYLOAD: dict[str, str] = {
    "name": "Minera Andina S.A.S.",
    "identification_type": "nit",
    "identification_number": "900123456",
    "email": "contact@minera-andina.com",
}


@pytest.fixture
def database() -> SqliteDatabase:
    """
    Use a real SQLite database, so allowed requests reach the repositories.

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


def _bearer(make_token: TokenFactory, permissions: list[str], role: str = "user") -> dict[str, str]:
    """
    Build the authorization header of a token carrying the given permissions.

    Args:
        make_token: Factory of signed tokens.
        permissions: Value of the `permissions` claim.
        role: Value of the `role` claim.

    Returns:
        The header.
    """
    return {"Authorization": f"Bearer {make_token(role=role, permissions=permissions)}"}


@pytest.mark.parametrize(
    ("method", "url", "permission"),
    [
        ("post", "/api/v1/clients", "clients:write"),
        ("get", "/api/v1/clients", "clients:read"),
        ("put", f"/api/v1/clients/{uuid4()}", "clients:write"),
        ("delete", f"/api/v1/clients/{uuid4()}", "clients:write"),
        ("post", "/api/v1/engines", "engines:write"),
        ("get", "/api/v1/engines", "engines:read"),
        ("delete", f"/api/v1/engines/{uuid4()}", "engines:write"),
        ("post", "/api/v1/repair-orders", "repair_orders:write"),
        ("get", "/api/v1/repair-orders", "repair_orders:read"),
        ("patch", f"/api/v1/repair-orders/{uuid4()}/status", "repair_orders:write"),
    ],
)
async def test_endpoint_requires_its_permission(
    client: AsyncClient,
    make_token: TokenFactory,
    method: str,
    url: str,
    permission: str,
) -> None:
    """A token without the permission an endpoint requires gets 403 naming that permission."""
    response: Response = await client.request(method, url, headers=_bearer(make_token, []), json={})
    assert response.status_code == 403
    assert response.json()["error"] == {
        "code": "forbidden",
        "message": f"This operation requires '{permission}'",
        "details": {"permission": permission},
    }


async def test_operator_reads_clients_but_cannot_register_them(client: AsyncClient, make_token: TokenFactory) -> None:
    """The default `user` permissions allow listing clients and refuse creating them."""
    headers: dict[str, str] = _bearer(make_token, OPERATOR_PERMISSIONS)
    listed: Response = await client.get("/api/v1/clients", headers=headers)
    created: Response = await client.post("/api/v1/clients", headers=headers, json=CLIENT_PAYLOAD)
    assert listed.status_code == 200
    assert created.status_code == 403


async def test_admin_with_write_permission_registers_clients(client: AsyncClient, make_token: TokenFactory) -> None:
    """A token carrying `clients:write` registers a client."""
    headers: dict[str, str] = _bearer(make_token, ["clients:read", "clients:write"], role="admin")
    response: Response = await client.post("/api/v1/clients", headers=headers, json=CLIENT_PAYLOAD)
    assert response.status_code == 201


async def test_root_holds_every_permission_regardless_of_the_claim(
    client: AsyncClient,
    make_token: TokenFactory,
) -> None:
    """`root` is never limited by the contents of its `permissions` claim."""
    headers: dict[str, str] = _bearer(make_token, [], role="root")
    response: Response = await client.post("/api/v1/clients", headers=headers, json=CLIENT_PAYLOAD)
    assert response.status_code == 201


async def test_me_exposes_the_known_permissions(client: AsyncClient, make_token: TokenFactory) -> None:
    """`/me` returns the permissions of the token, ignoring names this service does not know."""
    response: Response = await client.get(
        "/api/v1/me",
        headers=_bearer(make_token, ["clients:read", "future:thing"]),
    )
    assert response.status_code == 200
    assert response.json()["permissions"] == ["clients:read"]


@pytest.mark.parametrize("permissions", [None, "clients:read", [1, 2]])
async def test_token_without_a_valid_permissions_claim_is_rejected(
    client: AsyncClient,
    make_token: TokenFactory,
    permissions: object,
) -> None:
    """A missing or malformed `permissions` claim makes the token invalid."""
    token: str = make_token(permissions=permissions)
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
