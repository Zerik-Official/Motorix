"""Tests that every write is committed before its response leaves the server."""

# Standard library
from __future__ import annotations
from collections.abc import AsyncIterator, Awaitable, Callable, MutableMapping
from typing import Any

# Third-party
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

# Project imports
from app.db.base import Base

# Tests
from tests.conftest import SqliteDatabase, TokenFactory

Message = MutableMapping[str, Any]
CLIENT_PAYLOAD: dict[str, str] = {
    "name": "Minera Andina S.A.S.",
    "identification_type": "nit",
    "identification_number": "900123456",
    "email": "contact@minera-andina.com",
}


@pytest.fixture
def database() -> SqliteDatabase:
    """
    Use a real SQLite database, so the endpoint really commits.

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


def _recording(app: FastAPI, events: list[str]) -> Callable[..., Awaitable[None]]:
    """
    Wrap the application so the moment its response starts is recorded.

    Args:
        app: Application under test.
        events: List the events are appended to.

    Returns:
        An ASGI application that behaves like `app`.
    """

    async def wrapped(
        scope: MutableMapping[str, Any],
        receive: Callable[[], Awaitable[Message]],
        send: Callable[[Message], Awaitable[None]],
    ) -> None:
        """
        Forward the request and record when the response starts.

        Args:
            scope: ASGI connection scope.
            receive: ASGI receive channel.
            send: ASGI send channel.
        """

        async def recording_send(message: Message) -> None:
            """
            Record the start of the response before sending it.

            Args:
                message: ASGI message sent by the application.
            """
            if message["type"] == "http.response.start":
                events.append("response")
            await send(message)

        await app(scope, receive, recording_send)

    return wrapped


async def test_write_is_committed_before_the_response_is_sent(
    app: FastAPI,
    make_token: TokenFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A client that gets 201 can read the new row at once, because the commit already happened."""
    events: list[str] = []
    original_commit: Callable[[AsyncSession], Awaitable[None]] = AsyncSession.commit

    async def recording_commit(session: AsyncSession) -> None:
        """
        Record the commit, then run it.

        Args:
            session: Session being committed.
        """
        events.append("commit")
        await original_commit(session)

    monkeypatch.setattr(AsyncSession, "commit", recording_commit)
    headers: dict[str, str] = {"Authorization": f"Bearer {make_token()}"}
    async with AsyncClient(transport=ASGITransport(app=_recording(app, events)), base_url="http://test") as client:
        response: Response = await client.post("/api/v1/clients", headers=headers, json=CLIENT_PAYLOAD)

    assert response.status_code == 201
    assert events == ["commit", "response"]


async def test_failed_commit_is_reported_instead_of_a_success(
    app: FastAPI,
    make_token: TokenFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the commit fails, the client gets an error, never a 201 for a row that was not saved."""

    async def failing_commit(_session: AsyncSession) -> None:
        """
        Fail like a database that rejects the transaction.

        Args:
            _session: Session being committed.

        Raises:
            RuntimeError: Always.
        """
        raise RuntimeError("commit failed")

    monkeypatch.setattr(AsyncSession, "commit", failing_commit)
    headers: dict[str, str] = {"Authorization": f"Bearer {make_token()}"}
    transport: ASGITransport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response: Response = await client.post("/api/v1/clients", headers=headers, json=CLIENT_PAYLOAD)

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
