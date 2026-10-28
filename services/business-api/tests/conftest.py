"""Shared fixtures: an RSA key pair, settings, a fake database and an HTTP client."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator, Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

# Third-party
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Project imports
from app.core.config import Environment, Settings
from app.core.security import Permission
from app.db.session import Database
from app.main import create_app

ISSUER: str = "motorix-auth-api"
AUDIENCE: str = "motorix-business-api"

TokenFactory = Callable[..., str]


class FakeDatabase(Database):
    """Database whose health can be switched without a running PostgreSQL."""

    def __init__(self, available: bool = True) -> None:
        """
        Create the fake with an engine that never connects.

        Args:
            available: Result returned by `ping`.
        """
        super().__init__("postgresql+asyncpg://user:password@localhost:1/none")
        self.available: bool = available

    async def ping(self) -> bool:
        """
        Report the configured availability.

        Returns:
            The value of `available`.
        """
        return self.available


class SqliteDatabase(Database):
    """Async SQLite database on a single shared connection, so repository queries are real SQL."""

    def __init__(self) -> None:
        """Build an isolated in-memory engine; a caller creates the schema before using it."""
        self._engine = create_async_engine(
            "sqlite+aiosqlite://",
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)

    async def ping(self) -> bool:
        """
        Report the database as always reachable.

        Returns:
            True.
        """
        return True


def _generate_key_pair() -> tuple[str, str]:
    """
    Generate an RSA key pair in PEM format.

    Returns:
        The private and the public key.
    """
    key: rsa.RSAPrivateKey = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem: str = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem: str = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


@pytest.fixture(scope="session")
def key_pair() -> tuple[str, str]:
    """
    Provide the key pair trusted by the application under test.

    Returns:
        The private and the public key.
    """
    return _generate_key_pair()


@pytest.fixture(scope="session")
def foreign_private_key() -> str:
    """
    Provide a private key the application does not trust.

    Returns:
        A private key in PEM format.
    """
    return _generate_key_pair()[0]


@pytest.fixture
def settings(key_pair: tuple[str, str], tmp_path: Path) -> Settings:
    """
    Build settings isolated from the developer environment.

    Args:
        key_pair: Trusted key pair.
        tmp_path: Temporary folder for log files.

    Returns:
        The test settings.
    """
    return Settings(
        _env_file=None,
        environment=Environment.TEST,
        jwt_public_key=key_pair[1],
        jwt_issuer=ISSUER,
        jwt_audience=AUDIENCE,
        jwt_leeway_seconds=0,
        log_to_file=False,
        log_dir=tmp_path,
        max_page_size=50,
    )


@pytest.fixture
def database() -> FakeDatabase:
    """
    Provide a database that reports itself as available.

    Returns:
        The fake database.
    """
    return FakeDatabase()


@pytest.fixture
def app(settings: Settings, database: FakeDatabase) -> FastAPI:
    """
    Build the application under test.

    Args:
        settings: Test settings.
        database: Fake database.

    Returns:
        The application.
    """
    return create_app(settings, database)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """
    Provide an HTTP client bound to the application.

    Args:
        app: Application under test.

    Yields:
        The client.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        yield http_client


@pytest.fixture
def make_token(key_pair: tuple[str, str]) -> TokenFactory:
    """
    Provide a factory of tokens signed like auth-api signs them.

    Args:
        key_pair: Trusted key pair.

    Returns:
        A function that accepts claim overrides and an optional signing key.
    """

    def factory(private_key: str | None = None, expires_in: timedelta = timedelta(minutes=15), **claims: Any) -> str:
        """
        Sign a token.

        Args:
            private_key: Key used to sign; the trusted key when omitted.
            expires_in: Lifetime of the token, negative for an expired token.
            claims: Claims that replace or extend the default ones; None removes a claim.

        Returns:
            The encoded token.
        """
        now: datetime = datetime.now(timezone.utc)
        payload: dict[str, Any] = {
            "sub": str(uuid4()),
            "role": "user",
            "permissions": [permission.value for permission in Permission],
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "exp": now + expires_in,
        }
        payload.update(claims)
        payload = {name: value for name, value in payload.items() if value is not None}
        return jwt.encode(payload, private_key or key_pair[0], algorithm="RS256")

    return factory
