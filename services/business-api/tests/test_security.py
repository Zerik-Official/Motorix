"""Tests of the verification of access tokens issued by auth-api."""

# Standard library
from __future__ import annotations
from datetime import timedelta
from uuid import uuid4

# Third-party
import jwt
import pytest
from httpx import AsyncClient, Response

# Project imports
from tests.conftest import TokenFactory


async def test_valid_token_returns_identity(client: AsyncClient, make_token: TokenFactory) -> None:
    """A token signed with the trusted key exposes its subject and role."""
    user_id: str = str(uuid4())
    token: str = make_token(sub=user_id, role="admin")
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body: dict[str, str] = response.json()
    assert body["id"] == user_id
    assert body["role"] == "admin"


async def test_missing_token_is_rejected(client: AsyncClient) -> None:
    """A request without a token gets 401 with a bearer challenge."""
    response: Response = await client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"


async def test_expired_token_is_rejected(client: AsyncClient, make_token: TokenFactory) -> None:
    """An expired token is rejected even when its signature is valid."""
    token: str = make_token(expires_in=timedelta(seconds=-5))
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["message"] == "The access token has expired"


async def test_token_signed_with_foreign_key_is_rejected(
    client: AsyncClient,
    make_token: TokenFactory,
    foreign_private_key: str,
) -> None:
    """A token with valid claims but signed by another key is rejected."""
    token: str = make_token(private_key=foreign_private_key)
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


async def test_unsigned_token_is_rejected(client: AsyncClient) -> None:
    """A token that only decodes, with the `none` algorithm, is rejected."""
    token: str = jwt.encode({"sub": str(uuid4()), "role": "root"}, key="", algorithm="none")
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "claims",
    [
        {"iss": "another-issuer"},
        {"aud": "another-audience"},
        {"role": None},
        {"role": "superuser"},
        {"sub": "not-a-uuid"},
    ],
)
async def test_token_with_invalid_claims_is_rejected(
    client: AsyncClient,
    make_token: TokenFactory,
    claims: dict[str, str | None],
) -> None:
    """Wrong issuer or audience, and missing or malformed claims, are rejected."""
    response: Response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {make_token(**claims)}"})
    assert response.status_code == 401
